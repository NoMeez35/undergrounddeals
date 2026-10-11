## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Future versions

The public repo only holds the active version. Specs and glossary terms for later versions live in `futur/` (gitignored, its own private repo `undergrounddeals-futur`) and must never be committed here, nor mentioned in commit messages. See `futur/README.md` for promoting a version.
