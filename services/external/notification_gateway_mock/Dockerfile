FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONOPTIMIZE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

COPY requirements.txt /app/requirements.txt
RUN pip install --no-compile -r /app/requirements.txt \
    && useradd --create-home --shell /usr/sbin/nologin appuser

COPY --chown=appuser:appuser services/external/notification_gateway_mock /app

EXPOSE 8014

USER appuser

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8014", "--workers", "1"]
