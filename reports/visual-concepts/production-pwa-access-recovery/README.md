# Production PWA access recovery concept

## Status

Approved by Michael on 2026-08-28 as the source-level acceptance reference, with two binding corrections. Implementation, deployment, and live recovery verification remain separate.

The logo shown in the generated candidate is wrong. The proven current Maiks.yt website logo is `apps/web/public/brand/icon-64.png` (SHA-256 `0ea2c0babaa79b79bded15cfebe60f094acdb0cc2eca03c6f89834b8581d4d8a`), introduced by approved-logo commit `0ac6f7c45c863f0b26692914ed538a94e0396983`. The implementation must reuse that asset instead of recreating, restyling, or replacing it. The public website header belongs to the login/access-recovery screen only. After successful login, every PWA returns to its purpose-built app chrome and must not retain the public header.

## Visual scope

- Reuse the production public header and compact account-page language.
- Keep the recovery flow close to the top of the page with thin section dividers and no floating cards.
- Let the user renew the Maiks.yt account session with an OAuth provider that is currently configured in production; the four buttons in the image are presentation examples, not permission to expose an unavailable provider.
- Keep the launch token inside the installed PWA and out of the website URL, OAuth state, callback, page copy, and website-origin storage.
- Return only to an allowlisted PWA destination after sign-in.
- Revalidate the launch token, account session, linked identity, and current permissions when the PWA is reopened.
- Stack provider controls on narrow screens while keeping touch targets usable.
- Replace the candidate's generated logo with the proven current Maiks.yt website logo asset.
- Keep the public header out of authenticated Chat, Moderation, Control, Notifications, and any other actual PWA view; those screens retain their purpose-built app chrome and layout.

## Copy boundary

The page must not promise that the PWA token remains valid. A token can expire or be revoked independently of the account session. The truthful promise is that the token remains stored in the installed PWA and is checked again after the user returns.

## Artifact record

- Generated with the built-in ImageGen tool.
- Source: `/home/michael/.codex/generated_images/019ee64d-d00e-7c42-8341-b394df487b64/exec-fd9b682d-2ed4-4b26-896c-dc4489bab51b.png`
- Stored as: `reports/visual-concepts/production-pwa-access-recovery/access-recovery-candidate-v1.png`
- Dimensions: `1536 x 1024` pixels
- SHA-256: `d2569ad5ca4a3f1d0ae3e8d6c75142e8efe4e5db4eb87afc6c780f2bb5e53567`

## Change boundary

This registration adds one image and its design record. Approval authorizes a bounded implementation against this record using the proven website logo and recovery-only public header. It changes no application code, OAuth behavior, access-token behavior, migration, deployment, server, browser, or live state by itself.
