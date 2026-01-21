# PowerShell script to automatically set up DATABASE_URL from RENDER_DATABASE_URL.txt
# Writes/updates backend\.env (should remain gitignored)

Write-Host "Setting up DATABASE_URL automatically..." -ForegroundColor Cyan

$connectionStringFile = "RENDER_DATABASE_URL.txt"
$backendEnvFile = "backend\.env"

if (-not (Test-Path -LiteralPath $connectionStringFile)) {
  Write-Host "Error: $connectionStringFile not found!" -ForegroundColor Red
  exit 1
}

$content = Get-Content -LiteralPath $connectionStringFile -Raw
if ($content -notmatch 'postgresql://[^\s]+') {
  Write-Host "Error: Could not find a postgresql:// connection string in $connectionStringFile" -ForegroundColor Red
  exit 1
}

$connectionString = $matches[0]
Write-Host "Found connection string." -ForegroundColor Green

if (-not (Test-Path -LiteralPath "backend")) {
  Write-Host "Error: backend directory not found!" -ForegroundColor Red
  exit 1
}

$envLines = @()
if (Test-Path -LiteralPath $backendEnvFile) {
  Write-Host "Reading existing $backendEnvFile..." -ForegroundColor Yellow
  $envLines = Get-Content -LiteralPath $backendEnvFile
  $envLines = $envLines | Where-Object { $_ -notmatch '^DATABASE_URL=' }
}

$envLines += "DATABASE_URL=$connectionString"
$envLines | Set-Content -LiteralPath $backendEnvFile -Encoding UTF8

Write-Host "Successfully configured DATABASE_URL in $backendEnvFile" -ForegroundColor Green
Write-Host "Next: run 'npm run migrate-to-supabase'." -ForegroundColor Cyan
