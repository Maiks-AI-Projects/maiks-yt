# Production PWA access recovery concept

## Status

Candidate awaiting Michael's approval. No recovery-page implementation, deployment, or live verification is implied by this image.

## Visual scope

- Reuse the production public header and compact account-page language.
- Keep the recovery flow close to the top of the page with thin section dividers and no floating cards.
- Let the user renew the Maiks.yt account session with an OAuth provider that is currently configured in production; the four buttons in the image are presentation examples, not permission to expose an unavailable provider.
- Keep the launch token inside the installed PWA and out of the website URL, OAuth state, callback, page copy, and website-origin storage.
- Return only to an allowlisted PWA destination after sign-in.
- Revalidate the launch token, account session, linked identity, and current permissions when the PWA is reopened.
- Stack provider controls on narrow screens while keeping touch targets usable.

## Copy boundary

The page must not promise that the PWA token remains valid. A token can expire or be revoked independently of the account session. The truthful promise is that the token remains stored in the installed PWA and is checked again after the user returns.

## Artifact record

- Generated with the built-in ImageGen tool.
- Source: `/home/michael/.codex/generated_images/019ee64d-d00e-7c42-8341-b394df487b64/exec-fd9b682d-2ed4-4b26-896c-dc4489bab51b.png`
- Stored as: `reports/visual-concepts/production-pwa-access-recovery/access-recovery-candidate-v1.png`
- Dimensions: `1536 x 1024` pixels
- SHA-256: `d2569ad5ca4a3f1d0ae3e8d6c75142e8efe4e5db4eb87afc6c780f2bb5e53567`

## Change boundary

This registration adds one image and its design record. It changes no application code, OAuth behavior, access-token behavior, migration, deployment, server, browser, or live state.
