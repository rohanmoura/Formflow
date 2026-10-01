$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
$envPath = Join-Path $root ".env"

if (-not (Test-Path -LiteralPath $envPath)) {
  Copy-Item -LiteralPath (Join-Path $root ".env.example") -Destination $envPath
}

docker compose up -d postgres
if ($LASTEXITCODE -ne 0) { throw "PostgreSQL did not start. Check Docker Desktop." }

$ready = $false
for ($attempt = 0; $attempt -lt 30; $attempt++) {
  docker compose exec -T postgres pg_isready -U formflow -d formflow *> $null
  if ($LASTEXITCODE -eq 0) { $ready = $true; break }
  Start-Sleep -Seconds 2
}
if (-not $ready) { throw "PostgreSQL did not become healthy in time." }

pnpm install --frozen-lockfile
if ($LASTEXITCODE -ne 0) { throw "Dependency installation failed." }
pnpm db:generate
if ($LASTEXITCODE -ne 0) { throw "Prisma client generation failed." }
pnpm --filter @formflow/db build
if ($LASTEXITCODE -ne 0) { throw "Database package build failed." }
pnpm db:deploy
if ($LASTEXITCODE -ne 0) { throw "Database migrations failed." }

Write-Host "FormFlow is starting at http://localhost:3000"
pnpm dev
