# SOP-09 — Data Backup & Recovery SOP

| | |
|---|---|
| **Owner** | John |
| **Trigger** | Routinely (weekly check) + before any risky/destructive migration |
| **Definition of done** | A known-good, recent restore point exists and restore has been proven to work |
| **Related** | [SOP-07 Migration](SOP-07-database-migration.md) · [SOP-13 Rollback](SOP-13-rollback-hotfix.md) · [SOP-14 Incident](SOP-14-incident-response.md) |

---

## 1. Purpose & scope

Make sure tenant data is recoverable. This holds **multiple clients' safety
records** — data loss isn't just a setback, it's a breach of trust and possibly
of contract. A backup you've never restored is a hope, not a backup.

The production database is the Supabase `safetyiq` project (`bjgqjpekhicqlunxbobo`).

---

## 2. Rules

1. **Know your backup mechanism.** Confirm what the Supabase plan provides
   (daily backups and/or point-in-time recovery) and the retention window. If the
   plan's automatic backups don't meet the need, schedule an explicit dump.
2. **Back up before destructive change.** Any migration that drops/alters columns
   or rewrites data (SOP-07) requires a fresh restore point taken **immediately
   before**.
3. **Restore is tested, not assumed.** Periodically restore to a scratch project
   and confirm the data is intact — at least once, and after any change to the
   backup setup.
4. **Secrets are not in backups you commit.** DB backups may contain sensitive
   data; store them securely, never in git.

---

## 3. Procedure

### Routine (weekly)
1. Confirm the latest automatic backup/PITR point exists and is within retention.
2. Note the most recent known-good restore point.

### Before a risky migration
1. Take/confirm a fresh restore point.
2. Record the point + timestamp in the migration's plain-English note (SOP-07).
3. Proceed with the migration only once the restore point is confirmed.

### Recovery (data loss / corruption)
1. This is likely an incident (SOP-14) — assess scope first.
2. Restore from the most recent known-good point (PITR to just before the bad
   event if available).
3. Verify row counts / spot-check the affected tenant's data.
4. Never hand-edit production rows to "fix" corruption blind.

---

## 4. Checklist

```
[ ] backup mechanism + retention window known and adequate
[ ] recent known-good restore point exists (weekly check)
[ ] fresh restore point taken before any destructive migration
[ ] restore proven to work (tested to a scratch project at least once)
[ ] backups stored securely, never committed
```

---

*Revision: v1 · 2026-06-27 · first written. Confirm the live Supabase plan's
backup/PITR capability and fill in the retention window.*
