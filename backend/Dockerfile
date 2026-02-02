FROM python:3.11-slim

# Install LibreOffice for DOCX to PDF conversion
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-common \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy project files
COPY pyproject.toml .
COPY run.py .
COPY app/ ./app/

# Create virtual environment and install dependencies
RUN uv venv && uv pip install -r pyproject.toml

# Create data directories
RUN mkdir -p uploads data

EXPOSE 8001

CMD [".venv/bin/python", "run.py"]
