# Dev Key-Data Restore Dry Run

Date: 2026-07-10

Status: Passed for the key-data JSON dry-run path.

Issue: #26

## Scope

This drill exercised the existing owner-gated `GET /admin/backup/key-data-export` path against the dev environment and validated that the exported testing-critical rows can be parsed, reconstructed section-by-section, and checked without writing back to the shared dev database.

This was not a full MySQL dump restore. No production data, `.env` values, auth/session/token tables, provider runtime credentials, raw provider payloads, push secrets, Cloudflare/Docker config, filesystem uploads, or destructive restore commands were used.

## Commands Run

The raw export was written only to a temporary directory on `codex-server-1`, validated, then deleted. The first attempt produced no export because `docker exec` was missing `-i`; that empty file was discarded before the successful retry.

```bash
ssh -o BatchMode=yes -o ConnectTimeout=8 codex-server-1 'set -eu
WORK=/tmp/maiks-yt-key-data-restore-drill-20260710
rm -rf "$WORK"
mkdir -p "$WORK"
chmod 700 "$WORK"
docker exec -i maiks-yt-dev node - <<'"'"'NODE'"'"' > "$WORK/key-data-export.json"
const secret = process.env.DEV_OWNER_TOKEN_MINT_SECRET || process.env.DEV_TEST_AUTH_MINT_SECRET || process.env.DEV_NOTIFICATION_POST_SECRET;
if (!secret) throw new Error("dev owner token mint secret missing");
const apiUrl = process.env.API_PUBLIC_BASE_URL || "https://api-dev.maiks.yt";
const mintResponse = await fetch(new URL("/dev/testing/owner-token", apiUrl), {
  method: "POST",
  headers: { "content-type": "application/json", "x-dev-testing-secret": secret },
  body: JSON.stringify({ label: "issue-26-key-data-restore-drill", path: "/admin/backup/health", ttlMinutes: 5 })
});
const minted = await mintResponse.json();
if (!mintResponse.ok || minted?.ok !== true || typeof minted.token !== "string") throw new Error("owner token mint failed");
const exportResponse = await fetch(new URL("/admin/backup/key-data-export", apiUrl), {
  headers: { accept: "application/json", authorization: `Bearer ${minted.token}` }
});
if (!exportResponse.ok) throw new Error("key-data export failed");
process.stdout.write(await exportResponse.text());
NODE
chmod 600 "$WORK/key-data-export.json"
node - <<'"'"'NODE'"'"' "$WORK/key-data-export.json" > "$WORK/dry-run-summary.json"
# Inline validator: parse JSON, require the testing-critical sections, reject
# obvious token/secret-shaped markers, reconstruct section metadata only, and
# write a temporary restore-dry-run JSON artifact next to the raw export.
NODE
cat "$WORK/dry-run-summary.json"
rm -f "$WORK/key-data-export.json" "$WORK/key-data-export.json.restore-dry-run.json" "$WORK/dry-run-summary.json"
rmdir "$WORK"
'
```

The second `node - <<'NODE'` block was an inline one-off validator. It parsed the export, rejected unexpected payload shape, checked for obvious secret-shaped field markers, required the testing-critical sections below, reconstructed all sections to row/count metadata, wrote a temporary dry-run reconstruction JSON, printed only the redacted summary, and deleted all temporary artifacts.

## Result

- Export generated at: `2026-07-10T11:40:27.828Z`
- Redacted export checksum: `04bee5c7ddcb7254604cfe865b766c28f6b2680d60473ae6f1f05c01855db92a`
- Export sections: 24
- Total exported rows: 101
- Truncated sections: none
- Required testing-critical sections present: 16/16
- Every exported section had an array-shaped `rows` value and could be reconstructed to section metadata.
- Obvious secret-shaped markers checked by the validator were absent from the exported JSON: `token_hash`, `access_token`, `refresh_token`, `client_secret`, `private_key`.

## Required Section Counts

| Section | Rows |
| --- | ---: |
| `content_pages` | 1 |
| `creator_links` | 15 |
| `projects` | 3 |
| `project_milestones` | 3 |
| `project_items` | 3 |
| `project_item_links` | 1 |
| `project_updates` | 1 |
| `stream_schedule_entries` | 3 |
| `game_library_entries` | 3 |
| `game_suggestions` | 2 |
| `game_schedule_links` | 1 |
| `money_ledger_transactions` | 12 |
| `money_ledger_lines` | 12 |
| `money_rule_versions` | 0 |
| `money_receipt_references` | 4 |
| `money_accounting_warnings` | 1 |

## What Was Not Restored

- No full SQL dump was restored into a disposable MySQL database.
- No app instance was pointed at a disposable restored database.
- No auth/session/account/token/provider-credential tables were exported or restored.
- No raw provider payloads, push subscription secrets, env/config, Cloudflare/Docker config, or filesystem uploads were exported or restored.
- `money_rule_versions` was present and readable but currently had zero rows in the dev export.

## Follow-Up Issues

Create separate follow-up issues for:

- Full disposable MySQL dump restore once retention/encryption/operator policy is approved.
- Encrypted backup target and key ownership decision.
- App-owned upload/media backup plan before avatar/page media/project file uploads are added.
- Production restore runbook with rollback and post-restore smoke after production branch/config policy exists.
