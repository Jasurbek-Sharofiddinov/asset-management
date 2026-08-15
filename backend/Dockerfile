FROM python:3.12-slim

WORKDIR /app

# Non-root user (uid 1000 matches common host/dev expectation)
RUN groupadd --system --gid 1000 appuser \
 && useradd --system --uid 1000 --gid appuser --home-dir /app --shell /usr/sbin/nologin appuser

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
RUN chmod +x /app/entrypoint.sh && chown -R appuser:appuser /app

USER appuser

EXPOSE 8000
# Invoked via `sh` so a bind-mounted entrypoint.sh without the executable bit
# (common on Windows hosts) still runs. CMD is passed through to exec "$@".
ENTRYPOINT ["sh", "/app/entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
