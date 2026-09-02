# Use Python 3.11 slim image
FROM python:3.11.8-slim-bullseye

# Set working directory
WORKDIR /app

# Install system dependencies and Chromium
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gnupg \
    wget \
    ca-certificates \
    apt-transport-https \
    chromium \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the application code
COPY . .

# Create a non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Install pipx and notebooklm-cli as appuser
RUN pip install --user --no-cache-dir pipx && \
    /home/appuser/.local/bin/pipx ensurepath && \
    /home/appuser/.local/bin/pipx install notebooklm-cli

# Add pipx bin to PATH so 'nlm' is available for appuser
ENV PATH="/home/appuser/.local/bin:${PATH}"

# Expose the port
EXPOSE 5000

# Set environment variables
ENV FLASK_APP=main.py
ENV FLASK_ENV=production
ENV PYTHONPATH=/app

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/status || exit 1

# Run the application
CMD ["python", "main.py"]
