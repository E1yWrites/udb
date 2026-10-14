#!/usr/bin/env bash
# Stop hook: safety net so no edit is left uncommitted.
# Phase branch -> commit leftovers. main/detached -> block until moved to a phase branch.
input=$(cat)
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
[ -z "$(git status --porcelain)" ] && exit 0

branch=$(git branch --show-current)
if [ -z "$branch" ] || [ "$branch" = main ]; then
  # Already blocked once this stop; warn instead of looping forever.
  if printf '%s' "$input" | grep -q '"stop_hook_active": *true'; then
    echo '{"systemMessage":"UDB: uncommitted changes left on '"${branch:-detached HEAD}"'"}'
    exit 0
  fi
  echo "Uncommitted changes on '${branch:-detached HEAD}'. Move them to a phase-<n>-<slug> branch and commit there." >&2
  exit 2
fi

git add -A
git commit -q -m "chore: auto-commit leftover changes" || exit 1
echo '{"systemMessage":"UDB: auto-committed leftover changes on '"$branch"'"}'
