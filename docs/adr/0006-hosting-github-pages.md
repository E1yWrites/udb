# 6. Hosting on GitHub Pages, deployed from main

Status: accepted, 2026-10-15. Amended by ADR 12 (custom domain, prerendered public pages).

## Decision
GitHub Actions builds `main` and deploys it to GitHub Pages. That gives the
HTTPS secure context WebHID requires. There are no preview deploys, so code
reaches users only through a merged PR. No custom domain until the first
release.
