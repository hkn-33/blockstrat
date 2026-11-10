"""AI chat that builds a strategy. The model returns strategy JSON, never code (ADR 0001)."""

import json
import time
from collections import deque
from collections.abc import Callable
from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, ValidationError

from strategy_lab.market_data import Instrument
from strategy_lab.schema import TIMEFRAMES, StrategyDraft


class AiMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str = Field(min_length=1, max_length=2000)


class AiBuildRequest(BaseModel):
    messages: list[AiMessage] = Field(min_length=1, max_length=20)
    current_strategy: StrategyDraft | None = None


class AiReply(BaseModel):
    """What the model must return."""

    message: str = Field(description="Short reply to the user, in the user's language.")
    strategy: StrategyDraft | None = Field(
        description="The full strategy after applying the user's request, or null when nothing should change."
    )
    unsupported: list[str] = Field(
        description="Parts of the request the strategy schema cannot express. Empty when everything fit."
    )


class AiBuildOk(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    status: Literal["ok"] = "ok"
    message: str
    strategy: StrategyDraft | None
    unsupported: list[str]


class AiBuildFailed(BaseModel):
    model_config = ConfigDict(json_schema_serialization_defaults_required=True)

    status: Literal["rate_limited", "unavailable", "invalid"]
    message: str


AiBuildResponse = AiBuildOk | AiBuildFailed


class StrategyBuilder(Protocol):
    def reply(self, system_prompt: str, messages: list[AiMessage], response_schema: dict[str, object]) -> str:
        """Raw JSON text produced by the model."""
        ...


class GeminiStrategyBuilder:
    def __init__(self, api_key: str, model: str) -> None:
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model

    def reply(self, system_prompt: str, messages: list[AiMessage], response_schema: dict[str, object]) -> str:
        from google.genai import types

        contents = [
            types.Content(role="user" if message.role == "user" else "model", parts=[types.Part(text=message.text)])
            for message in messages
        ]
        response = self._client.models.generate_content(
            model=self._model,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                response_mime_type="application/json",
                response_json_schema=response_schema,
            ),
        )
        return response.text or ""


class RateLimiter:
    """Per-IP hourly limit plus a global daily cap, kept in memory (one backend process)."""

    def __init__(self, per_ip_per_hour: int, global_per_day: int, clock: Callable[[], float] = time.time) -> None:
        self._per_ip_per_hour = per_ip_per_hour
        self._global_per_day = global_per_day
        self._clock = clock
        self._by_ip: dict[str, deque[float]] = {}
        self._global: deque[float] = deque()

    def allow(self, ip: str) -> bool:
        now = self._clock()
        ip_calls = self._by_ip.setdefault(ip, deque())
        _drop_older_than(ip_calls, now - 3600)
        _drop_older_than(self._global, now - 86_400)
        if len(ip_calls) >= self._per_ip_per_hour or len(self._global) >= self._global_per_day:
            return False
        ip_calls.append(now)
        self._global.append(now)
        return True


def _drop_older_than(calls: deque[float], cutoff: float) -> None:
    while calls and calls[0] < cutoff:
        calls.popleft()


RESTING_MESSAGE = "AI is resting, build the blocks by hand."


def build_strategy(
    request: AiBuildRequest,
    builder: StrategyBuilder | None,
    instruments: tuple[Instrument, ...],
) -> AiBuildResponse:
    if builder is None:
        return AiBuildFailed(status="unavailable", message=RESTING_MESSAGE)

    messages = list(request.messages)
    if request.current_strategy is not None:
        current = request.current_strategy.model_dump_json(exclude_none=True)
        messages[-1] = AiMessage(
            role="user",
            text=f"{messages[-1].text}\n\n(Current strategy in the editor: {current})",
        )

    raw = builder.reply(_system_prompt(instruments), messages, AiReply.model_json_schema())
    try:
        reply = AiReply.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError):
        return AiBuildFailed(status="invalid", message="The AI returned a strategy that does not fit the blocks. Try rephrasing.")
    return AiBuildOk(message=reply.message, strategy=reply.strategy, unsupported=reply.unsupported)


def _system_prompt(instruments: tuple[Instrument, ...]) -> str:
    symbols = ", ".join(f"{instrument.symbol} ({instrument.label})" for instrument in instruments)
    return f"""You help users of Strategy Lab build a trading strategy from blocks for backtesting on historical data.
Return the complete strategy as JSON that matches the response schema exactly; never return code.

Rules:
- Instruments (use the symbol): {symbols}.
- Timeframes: {", ".join(TIMEFRAMES)}.
- A strategy has one entry rule (long or short with a condition) and an exit: an exit rule, a stop-loss %, a take-profit %, or a combination.
- Conditions compare two operands (price fields, SMA, EMA, RSI, MACD lines, Bollinger bands, constants) with gt, lt, crosses_above or crosses_below, and combine with and / or / not.
- Keep parts the user did not ask to change exactly as they are in the current strategy.
- If the user wants something the schema cannot express (other indicators, several instruments, pyramiding, time-of-day rules, live trading), build the closest strategy you can and list what you left out in "unsupported".
- If the request is not about building a strategy, set "strategy" to null and say what you can help with.
- Do not give investment advice or predict prices; this is a tool for testing ideas on past data.
- Reply in the user's language, in one or two short sentences."""
