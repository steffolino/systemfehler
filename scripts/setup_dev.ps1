param(
  [switch]$Force
)

Write-Output '== Systemfehler dev setup (Windows) =='

if (Get-Command conda -ErrorAction SilentlyContinue) {
  Write-Output 'Conda found — creating conda env "systemfehler-dev"...'
  conda env create -f "$(Split-Path -Parent $MyInvocation.MyCommand.Path)\..\dev-setup\environment.yml" --force
  Write-Output 'Conda environment created. Activate with:'
  Write-Output '  conda activate systemfehler-dev'
  return
}

Write-Output 'Conda not found — creating virtualenv at .venv'
python -m venv .venv
Write-Output 'Activating venv and installing requirements (may require build tools for some packages)'
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip setuptools wheel

try {
  python -m pip install --only-binary=:all: lxml psycopg2-binary
} catch {
  Write-Output 'Binary wheel install failed; pip will attempt to build from source (may require Visual C++ build tools)'
}

python -m pip install -r crawlers/requirements.txt

Write-Output 'Setup complete. Activate the venv with:'
Write-Output '  .\\.venv\\Scripts\\Activate.ps1'
