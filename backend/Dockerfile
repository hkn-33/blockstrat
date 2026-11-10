FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.12.5 /uv /bin/uv

WORKDIR /app
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    MARKET_DATA_DIR=/data

# Dependencies first, so code changes do not reinstall them.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY src ./src
RUN uv sync --frozen --no-dev

EXPOSE 8000
# Proxy headers are trusted from anyone because the port is only reachable from Caddy inside the
# compose network; the per-IP AI limit relies on the real client IP from X-Forwarded-For.
CMD ["/app/.venv/bin/uvicorn", "blockstrat.api:create_default_app", "--factory", \
     "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]
