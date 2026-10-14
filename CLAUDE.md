# UDB — Universal Driver Bus

The project brief is in `PROMPT.md`. Read it before starting any phase.

## Git workflow (mandatory)
- Never commit to `main` directly. It changes only through merged PRs.
- Each phase works on its own branch, `phase-<n>-<slug>`, cut from an up-to-date `main`. Run `git switch main && git pull` before branching.
- Commit after every logical change. Use conventional messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
- Never add a `Co-Authored-By: Claude` trailer, a "Generated with Claude Code" line, or a claude.ai session or chat link to a commit, PR or committed file.
- The Stop hook (`.claude/hooks/autocommit.sh`) is a safety net, not the workflow. If it reports an auto-commit, the previous change should have been committed by hand.

## Phase gate
A phase passes when its exit criteria (in `ROADMAP.md`, once it exists) are met and all checks pass: tests, typecheck and build, once code exists. Then:
1. Ask the user, with AskUserQuestion, whether to open a PR for the phase.
2. If they say yes, run `git push -u origin <branch>`, then `gh pr create --base main`. The PR body must cover: completed work, verified devices, unverified assumptions, blockers, next steps.
3. The user reviews and merges. Never merge a PR yourself.
If any check fails, do not ask about a PR. Report the failure and fix it on the branch.

## Truthfulness rules
- A simulator or replay result is never evidence of hardware support. Only `write-verified` status, with recorded hardware evidence, counts.
- Never send firmware, bootloader or DFU commands without the user's separate approval.
- Every write to a device is read back. Report what the device actually returned.
