# Maiks.yt OpenBao production-secret migration

Last checked: 2026-08-29T03:23:29+02:00

Target environment: Michael-Server-1 production API and Rpi4-Vault OpenBao 2.6.2

| Capability | Design | Approval | Implementation | Integration | Deployment | Verification | Evidence | Next action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Restricted ms1-to-vault transport | done | done | done | done | done | done | Dedicated Ed25519 identity; Rpi4-Vault authorizes only port forwarding to \`127.0.0.1:8200\`; ms1 user tunnel binds only \`127.0.0.1:18201\`; exact OpenBao health returned initialized, unsealed, active, version 2.6.2. | Retain the exact restricted key and host-key pin. |
| Maiks API machine authentication | done | done | done | done | done | done | AppRole \`maiks-yt-api\`; policy \`maiks-yt-api-secrets\`; one-off login proved allowed path \`200\`, Password Manager path \`403\`, policy administration \`403\`, then revoked its verification token. | Add future paths one at a time with a policy regression. |
| Agent rendering and rotation | done | done | done | done | done | done | OpenBao Agent 2.6.2 on ms1; source and rendered SHA-256 matched; two rotations propagated; files are mode \`0600\`; Agent and tunnel are enabled/active and user linger is enabled. | Keep secret material out of Git, Docker metadata reports, and normal logs. |
| Vault-outage continuity | done | done | done | done | done | done | With the tunnel stopped, Agent remained active and retained the last good render. API remained healthy. API also recreated successfully while OpenBao was unreachable, using the retained render; Agent recovered automatically after tunnel restoration. | Rehearse the same behavior after an actual host reboot once convenient. |
| Docker injection and rollback | done | done | done | done | done | done | Synthetic canary injected into the exact API image, rotated after controlled recreate, then removed by an exact rollback recreate. Web, Control, Overlay, volumes, database, and image identity were preserved. | Keep the production Compose source test in the standard review gate. |
| Twitch EventSub webhook secret | done | done | done | done | done | in-progress | The effective production value was imported without display to \`secret/data/maiks-yt/production/api/twitch-eventsub\`. Source, OpenBao render, and container SHA-256 matched. The line was removed from \`.env.production\`; API is healthy on exact image \`sha256:0a765f9e...a9d4\`. Real provider delivery was not generated merely for migration proof. | Verify naturally received EventSub traffic when Twitch credentials and subscriptions are next rehearsed. |
| Ordinary production deployment path | done | done | done | done | done | done | Production Compose loads the ignored Agent render after the ordinary environment. A standard API-only recreate, pinned to the exact existing image, became healthy/restart0 and matched the rendered secret hash without changing Web, Control, Overlay, or either application volume. | Keep the source test in both review and full gates. |
| Unattended encrypted snapshot | done | done | done | done | done | done | The enabled Rpi4-Vault timer fired naturally at 03:23:16 CEST, produced \`openbao-20260829T012317Z.snap\`, reported 44,060 bytes and SHA-256 \`33f4d0180242efb1b451973d076acb3bbcc3ad9987735be5531496e76c136aab\`, exited successfully, and scheduled the next run. | Isolated restore rehearsal remains separate. |

## Preserved state

- Final API image remains \`sha256:0a765f9ed350a17db63fb94a661c7313f7c0471efe314fe3f4fa6ae73c37a9d4\`.
- Final API container at receipt time: \`7a5d68c380be2c97994430181858a6795efdf3f534a8649f96e31b8600488b33\`, healthy, restart count zero.
- Web container remained \`3c1a66ea...\` on image \`sha256:8a3736b4...b21cd\`.
- Control remained \`ee4559d6...\`; Overlay remained \`07adeebe...\`.
- \`maiks-yt-production-profile-images\` and \`maiks-yt-production-music-audio\` remained mounted read/write.
- Repository and production database contents were not changed by the live secret migration.

## Secret boundaries

- No secret value, root token, AppRole RoleID, AppRole SecretID, or rendered environment content is stored in this repository or receipt.
- \`.env.openbao.production\` is ignored by Git.
- OpenBao Agent owns the rendered file at mode \`0600\`.
- The temporary \`.env.production\` rollback copy and local bootstrap credential files were removed after live verification.
- The existing \`.env.production\` remains the source for credentials not yet migrated.

## Remaining limits

- A naturally received Twitch EventSub request has not yet proved the migrated verifier in a provider-backed path.
- Rpi4-Vault still requires unsealing after a full reboot. Existing rendered files allow Maiks API continuity while it is sealed, but rotation and new retrieval wait for unseal.
- OpenBao snapshot creation is proven; an isolated snapshot restore rehearsal remains separate.
