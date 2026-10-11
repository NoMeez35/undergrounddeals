## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default canonical labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

### Future versions

The public repo only holds the active version. Specs and glossary terms for later versions live in `futur/` (gitignored, its own private repo `undergrounddeals-futur`) and must never be committed here, nor mentioned in commit messages. See `futur/README.md` for promoting a version.

## Database migrations

A migration in `worker/migrations/` runs on a production database that already holds data: every column it adds that the app reads gets, in the same migration, a value for the existing rows. Each such migration gets a test in `worker/test/migrations.test.js` that fills the database at the previous schema, applies it, and checks the app still reads that data.
