# Dockerfile for IntelliApprove FastAPI Backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt email-validator

# Copy application code
COPY . .

# Expose FastAPI port
EXPOSE 8000

# Run uvicorn server
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
