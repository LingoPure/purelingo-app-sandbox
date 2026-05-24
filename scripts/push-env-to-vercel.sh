#!/usr/bin/env bash
# Push every var in .env.local up to the linked Vercel project. Secrets (API
# keys, tokens, service-role keys, connection strings, etc.) are pushed
# --sensitive to production+preview only; public NEXT_PUBLIC_* and plain config
# vars go to all three environments. Idempotent: removes then re-adds, so
# re-running is safe after rotating a key.
#
# Usage:
#   bash scripts/push-env-to-vercel.sh                # push all
#   bash scripts/push-env-to-vercel.sh KEY1 KEY2      # push only listed keys
#
# Prereqs: vercel CLI logged in (vercel whoami), project linked (.vercel/project.json
# exists — done once via `vercel link`).

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.local}"
[[ -f "$ENV_FILE" ]] || { echo "✗ $ENV_FILE not found"; exit 1; }
[[ -f .vercel/project.json ]] || { echo "✗ run 'vercel link' first"; exit 1; }

# Skip these — set automatically by Vercel runtime.
SKIP=( VERCEL_OIDC_TOKEN VERCEL_ENV VERCEL_URL VERCEL_REGION )

ONLY=("$@")  # if empty, push everything

pushed=0
skipped=0
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip blank lines and comments
  [[ -z "${line// }" ]] && continue
  [[ "$line" =~ ^[[:space:]]*# ]] && continue

  key="${line%%=*}"
  value="${line#*=}"
  key="${key// /}"

  # Strip wrapping single/double quotes if present
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"

  [[ -z "$key" ]] && continue
  [[ -z "$value" ]] && { echo "·  skip empty: $key"; skipped=$((skipped+1)); continue; }

  # Skip Vercel-managed
  for s in "${SKIP[@]}"; do
    if [[ "$key" == "$s" ]]; then
      echo "·  skip managed: $key"
      skipped=$((skipped+1))
      continue 2
    fi
  done

  # If user passed specific keys, skip the rest
  if [[ ${#ONLY[@]} -gt 0 ]]; then
    match=0
    for w in "${ONLY[@]}"; do [[ "$key" == "$w" ]] && match=1; done
    [[ $match -eq 0 ]] && continue
  fi

  # Secrets are pushed --sensitive (non-readable, which clears Vercel's
  # post-April-2026 "Needs Attention" flag) and only to production+preview,
  # because sensitive vars cannot target the development environment. Public
  # (NEXT_PUBLIC_*) and plain config vars stay readable across all three envs.
  # Local dev reads every var from .env.local regardless of this.
  if [[ "$key" != NEXT_PUBLIC_* ]] && \
     [[ "$key" =~ (KEY|SECRET|TOKEN|PASSWORD|PASSPHRASE|PRIVATE|SERVICE_ROLE|WEBHOOK|CREDENTIAL|ACCESS_KEY|_DSN|POSTGRES_URL|DATABASE_URL|REDIS_URL|MONGO|CONNECTION_STRING) ]]; then
    target_envs=(production preview)
    sensitive_flag="--sensitive"
  else
    target_envs=(production preview development)
    sensitive_flag=""
  fi
  # Remove existing (ignore errors if absent), then add fresh per environment.
  for env in "${target_envs[@]}"; do
    vercel env rm "$key" "$env" --yes >/dev/null 2>&1 || true
    printf '%s' "$value" | vercel env add "$key" "$env" $sensitive_flag >/dev/null 2>&1 || true
  done
  echo "✓  $key  →  ${target_envs[*]}$([ -n "$sensitive_flag" ] && echo '  (sensitive)')"
  pushed=$((pushed+1))
done < "$ENV_FILE"

echo
echo "Done. $pushed pushed, $skipped skipped."
