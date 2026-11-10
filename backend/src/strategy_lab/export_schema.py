"""Writes the JSON Schema of the API types; the frontend generates its TypeScript types from it.

Usage: uv run python -m strategy_lab.export_schema <output path>
"""

import json
import sys
from pathlib import Path

from pydantic import BaseModel

from strategy_lab.ai import AiBuildRequest, AiBuildResponse
from strategy_lab.api import ExecutionPreset, InstrumentsResponse
from strategy_lab.schema import BacktestRequest, BacktestResponse, Strategy, StrategyDraft


class ApiTypes(BaseModel):
    """Not an API payload: a single root that references every type the frontend needs."""

    strategy: Strategy
    strategy_draft: StrategyDraft
    backtest_request: BacktestRequest
    backtest_response: BacktestResponse
    instruments_response: InstrumentsResponse
    execution_preset: ExecutionPreset
    ai_build_request: AiBuildRequest
    ai_build_response: AiBuildResponse


def _drop_property_titles(node: object) -> None:
    """Pydantic titles every property; json2ts would turn each title into a noise alias like `Kind3`."""
    if isinstance(node, dict):
        for property_schema in node.get("properties", {}).values():
            property_schema.pop("title", None)
        for child in node.values():
            _drop_property_titles(child)
    elif isinstance(node, list):
        for child in node:
            _drop_property_titles(child)


def main() -> None:
    output = Path(sys.argv[1])
    schema = ApiTypes.model_json_schema(mode="serialization")
    _drop_property_titles(schema)
    output.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
