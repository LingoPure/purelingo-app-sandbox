# Push all local migrations to the linked Supabase production project
# (nbvprbaumwmfczsfcyrv). Idempotent — supabase db push applies only
# migrations that haven't run on the remote yet (0037..0045 here).
#
# Usage:
#   .\scripts\push-migrations.ps1
#
# The CLI prompts for SUPABASE_DB_PASSWORD if not already set.
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot -Parent)

Write-Host "==> linking project + status" -ForegroundColor Cyan
npx supabase status --linked | Out-Null

Write-Host "==> pushing unapplied migrations to production" -ForegroundColor Cyan
if (-not $env:SUPABASE_DB_PASSWORD) {
  npx supabase db push --linked --include-all
} else {
  npx supabase db push --linked --include-all --password $env:SUPABASE_DB_PASSWORD
}

Write-Host "==> verifying: migrations present on remote" -ForegroundColor Cyan
npx supabase migration list --linked

Write-Host "Done. If you saw LOCAL | REMOTE columns match up to 0045, the spine is live." -ForegroundColor Green