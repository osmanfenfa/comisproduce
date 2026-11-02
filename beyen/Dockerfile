FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd --system --no-create-home comis && chown -R comis /app
USER comis
EXPOSE 8000
# Apply migrations + seed, then serve. --proxy-headers makes rate limiting see the
# real client IP from nginx; the backend port is not published, only nginx can reach it.
CMD ["sh", "-c", "python -m app.db.migrate && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'"]
