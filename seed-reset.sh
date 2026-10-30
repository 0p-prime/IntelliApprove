#!/usr/bin/env bash
# IntelliApprove - One-Step Clean Demo Data Reset (Linux/macOS)
set -e

echo "Restoring clean IntelliApprove demo evaluation dataset..."
if [ -f "venv/bin/python" ]; then
    venv/bin/python seed_reset.py
else
    python3 seed_reset.py
fi

