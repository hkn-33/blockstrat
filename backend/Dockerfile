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

# The limits count requests per client address, which the reverse proxy (Coolify's Traefik, or Caddy) passes in
# X-Forwarded-For. It is believed only from the private networks such a proxy runs on, so a client cannot claim
# another address and slip past the limits; set FORWARDED_ALLOW_IPS to the proxy's address to narrow it further.
ENV FORWARDED_ALLOW_IPS="127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16"

# Runs as a user without rights over the image; it owns only the market-data cache.
RUN useradd --system --no-create-home blockstrat && mkdir -p /data && chown blockstrat /data
USER blockstrat

EXPOSE 8000
# No access log: it would keep every visitor's address. Errors are still logged, without request bodies.
CMD ["/app/.venv/bin/uvicorn", "blockstrat.api:create_default_app", "--factory", \
     "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--no-access-log", "--no-server-header"]
