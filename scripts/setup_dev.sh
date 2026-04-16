#!/usr/bin/env bash
set -euo pipefail

echo "== Systemfehler dev setup script =="

if command -v conda >/dev/null 2>&1; then
  echo "Conda found — creating conda env 'systemfehler-dev'..."
  conda env create -f "$(dirname "$0")/../dev-setup/environment.yml" --force
  echo "Conda environment created. Activate with:"
  echo "  conda activate systemfehler-dev"
  echo "You can now run crawlers or start the app using the conda env."
  exit 0
fi

echo "Conda not found — falling back to virtualenv at .venv"
python -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip setuptools wheel

echo "Attempting to install prebuilt wheels for lxml and psycopg2 (may fail)"
python -m pip install --only-binary=:all: lxml psycopg2-binary || true

echo "Installing remaining Python requirements..."
python -m pip install -r crawlers/requirements.txt

echo "Virtualenv created. Activate with: source .venv/bin/activate"
