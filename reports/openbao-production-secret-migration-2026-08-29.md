# Maiks.yt OpenBao production-secret migration

Last checked: 2026-08-29T05:05:00+02:00

Target environment: Michael-Server-1 production API and Rpi4-Vault OpenBao 2.6.2

| Capability | Design | Approval | Implementation | Integration | Deployment | Verification | Evidence | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Restricted ms1-to-vault transport | done | done | done | done | done | done | Dedicated Ed25519 identity; Rpi4-Vault authorizes only port forwarding to \`127.0.0.1:8200\`; ms1 user tunnel binds only \`127.0.0.1:18201\`; exact OpenBao health returned initialized, unsealed, active, version 2.6.2. | Retain the exact restricted key and host-key pin. |
| Maiks API machine authentication | done | done | done | done | done | done | AppRole \`maiks-yt-api\`; policy \`maiks-yt-api-secrets\`; one-off login proved allowed path \`200\`, Password Manager path \`403\`, policy administration \`403\`, then revoked its verification token. | Add future paths one at a time with a policy regression. |
| Agent rendering and rotation | done | done | done | done | done | done | OpenBao Agent 2.6.2 on ms1; source and rendered SHA-256 matched; two rotations propagated; files are mode \`0600\`; Agent and tunnel are enabled/active and user linger is enabled. | Keep secret material out of Git, Docker metadata reports, and normal logs. |
| Vault-outage continuity | done | done | done | done | done | done | With the tunnel stopped, Agent remained active and retained the last good render. API remained healthy. API also recreated successfully while OpenBao was unreachable, using the retained render; Agent recovered automatically after tunnel restoration. | Rehearse the same behavior after an actual host reboot once convenient. |
| Docker injection and rollback | done | done | done | done | done | done | Synthetic canary injected into the exact API image, rotated after controlled recreate, then removed by an exact rollback recreate. Web, Control, Overlay, volumes, database, and image identity were preserved. | Keep the production Compose source test in the standard review gate. |
| Twitch EventSub webhook secret | done | done | done | done | done | in-progress | The effective production value was imported without display to \`secret/data/maiks-yt/production/api/twitch-eventsub\`. Source, OpenBao render, and container SHA-256 matched. The line was removed from \`.env.production\`; API is healthy on exact image \`sha256:0a765f9e...a9d4\`. Real provider delivery was not generated merely for migration proof. | Verify naturally received EventSub traffic when Twitch credentials and subscriptions are next rehearsed. |
| OAuth client secrets | done | done | done | done | done | done | GitHub, Google/YouTube, and Discord client secrets are at version 1 in \`oauth-github\`, \`oauth-google\`, and \`oauth-discord\`. Exact hashes matched and the real token endpoints retained their expected invalid-code responses before and after plaintext removal. | Rotate only through a separately planned provider action. |
| Discord bot and Twitch app | done | done | done | done | done | done | \`discord-bot\` and \`twitch-client\` are at version 1. Discord bot identity returned \`200\`; Twitch client credentials minted and immediately revoked a temporary app token. Both checks passed after plaintext removal. | Exercise normal provider intake independently of storage proof. |
| Twitch chat bot bundle | done | done | done | done | done | done | Access token, refresh token, and expiry moved unchanged as one version-1 \`twitch-chat-bot\` unit. All three source/render/container hashes matched. Twitch validation returned \`401\` before and after, preserving the truthful expired/\`needs_attention\` state. | Reauthorize later; do not refresh credentials as part of migration. |
| Database and Better Auth runtime | done | done | done | done | done | done | \`database\` and \`auth-signing\` are at version 1. Database health and a real Better Auth GitHub OAuth-start response returned \`200\` after plaintext removal. Current database rows were not changed by this static phase. | Protect OAuth/session values already stored in MariaDB as a separate phase. |
| Better Auth OAuth account tokens | done | done | done | done | done | done | Commit \`6bddc81\` deploys mixed-read AES-256-GCM account-token protection using the version-1 OpenBao \`auth-data-protection\` key. An encrypted mode-\`0600\` rollback artifact was verified before one transaction converted four account rows and eight non-null fields. All eight envelopes decrypt, zero plaintext non-null OAuth fields remain, an existing session still resolves, and the provider-profile path returned a real GitHub option without envelope leakage. | Encrypt verification values and future provider-runtime writes, then introduce dual-compatible session hashing through a separately reviewed migration. |
| Better Auth session tokens | done | done | done | done | done | done | Commit \`8994e90\` deploys AES-256-GCM storage plus domain-separated HMAC lookup. Encrypted backup \`session-token-migration-20260829T033209Z.sql.gz.gpg\` was verified before applying only migration 0030 and converting three rows in one compare-and-set transaction. The pre-existing active session and real `/admin/sessions` read both remained valid; zero plaintext session rows remain. | Protect verification identifiers/values next; retain ciphertext because Better Auth list/revoke reads the token. |
| Steam bootstrap credential | done | done | done | done | done | done | \`steam\` is at version 1. The container-held key returned a valid Steam player-summary response before and after plaintext removal. The app does not yet consume this key, so this proves credential continuity rather than Games integration. | Reuse the protected credential when the Games provider cache is implemented. |
| Source-controlled render contract | done | done | done | done | done | done | A secret-free Agent template records the exact allowlisted production API key/path mapping. Focused source tests reject extra paths/keys, bootstrap/admin material, and literal values. | Install only reviewed template revisions; never commit the live render. |
| Ordinary production deployment path | done | done | done | done | done | done | Production Compose loads the ignored Agent render after the ordinary environment. A standard API-only recreate, pinned to the exact existing image, became healthy/restart0 and matched the rendered secret hash without changing Web, Control, Overlay, or either application volume. | Keep the source test in both review and full gates. |
| Unattended encrypted snapshot | done | done | done | done | done | done | The enabled Rpi4-Vault timer fired naturally at 03:23:16 CEST, produced \`openbao-20260829T012317Z.snap\`, reported 44,060 bytes and SHA-256 \`33f4d0180242efb1b451973d076acb3bbcc3ad9987735be5531496e76c136aab\`, exited successfully, and scheduled the next run. | Isolated restore rehearsal remains separate. |

## Preserved state

- Final API image is \`sha256:52915065fbd660e2bd072191fa6f3bcab000686a7bff077f979818fb1f2302b3\` at source revision \`8994e90a67d343187aa8d1c5ce5fcaeb269ccc5b\`.
- Final API container is healthy with restart count zero; Web, Control, and Overlay were preserved during the API-only recreate.
- Web container remained \`3c1a66ea...\` on image \`sha256:8a3736b4...b21cd\`.
- Control remained \`ee4559d6...\`; Overlay remained \`07adeebe...\`.
- \`maiks-yt-production-profile-images\` and \`maiks-yt-production-music-audio\` remained mounted read/write.
- The static credential phase did not change production database contents. The authorized dynamic phase encrypted eight existing OAuth token fields, applied only session migration 0030, and protected all three session rows. Profiles migration 0031 remains unapplied.

## Secret boundaries

- No secret value, root token, AppRole RoleID, AppRole SecretID, or rendered environment content is stored in this repository or receipt.
- \`.env.openbao.production\` is ignored by Git.
- OpenBao Agent owns the rendered file at mode \`0600\`.
- The temporary \`.env.production\` rollback copy and local bootstrap credential files were removed after live verification.
- \`.env.production\` retains ordinary configuration only. Every identified application credential now comes from the mode-\`0600\` Agent render.
- Existing Better Auth OAuth account tokens and session tokens are now protected at rest. Verification identifiers/values remain the next bounded unit; \`url_access_tokens\` already stores only hashes and stays unchanged.

## Remaining limits

- A naturally received Twitch EventSub request has not yet proved the migrated verifier in a provider-backed path.
- Rpi4-Vault still requires unsealing after a full reboot. Existing rendered files allow Maiks API continuity while it is sealed, but rotation and new retrieval wait for unseal.
- OpenBao snapshot creation is proven; an isolated snapshot restore rehearsal remains separate.
