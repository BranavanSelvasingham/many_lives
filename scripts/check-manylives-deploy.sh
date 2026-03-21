#!/usr/bin/env bash

set -euo pipefail

WORKFLOW_FILE=".github/workflows/main_manylives.yml"
DEFAULT_SITE_URL="https://manylives-sim.branavan.com"
DEFAULT_INTERVAL_SECONDS=20
DEFAULT_MAX_ATTEMPTS=45

target_sha="${1:-$(git rev-parse HEAD)}"
site_url="${MANY_LIVES_DEPLOY_URL:-$DEFAULT_SITE_URL}"
interval_seconds="${DEPLOY_CHECK_INTERVAL_SECONDS:-$DEFAULT_INTERVAL_SECONDS}"
max_attempts="${DEPLOY_CHECK_MAX_ATTEMPTS:-$DEFAULT_MAX_ATTEMPTS}"

attempt=1

echo "Watching Many Lives deployment for commit ${target_sha}"
echo "Workflow: ${WORKFLOW_FILE}"
echo "Site: ${site_url}"
echo "Interval: ${interval_seconds}s, max attempts: ${max_attempts}"

while (( attempt <= max_attempts )); do
  echo
  echo "Attempt ${attempt}/${max_attempts}"

  run_tsv="$(
    gh run list \
      --workflow "${WORKFLOW_FILE}" \
      --branch main \
      --limit 20 \
      --json databaseId,headSha,status,conclusion,url \
      --jq "map(select(.headSha == \"${target_sha}\")) | .[0] | [.databaseId, .status, .conclusion, .url] | @tsv"
  )"

  if [[ -z "${run_tsv}" || "${run_tsv}" == "null" ]]; then
    echo "No workflow run found yet for ${target_sha}."
  else
    IFS=$'\t' read -r run_id run_status run_conclusion run_url <<< "${run_tsv}"

    echo "Workflow run: ${run_id}"
    echo "Run URL: ${run_url}"
    echo "Status: ${run_status}"
    echo "Conclusion: ${run_conclusion}"

    if [[ "${run_status}" == "completed" && "${run_conclusion}" != "success" ]]; then
      echo "Deployment workflow finished without success."
      exit 1
    fi

    if [[ "${run_status}" == "completed" && "${run_conclusion}" == "success" ]]; then
      http_status="$(
        curl \
          --silent \
          --show-error \
          --location \
          --output /tmp/manylives-deploy-check.html \
          --write-out '%{http_code}' \
          "${site_url}?sha=${target_sha}"
      )"

      echo "Site HTTP status: ${http_status}"

      if [[ "${http_status}" == "200" ]]; then
        echo "Deployment looks healthy."
        exit 0
      fi
    fi
  fi

  attempt=$((attempt + 1))
  sleep "${interval_seconds}"
done

echo "Timed out waiting for deployment success."
exit 2
