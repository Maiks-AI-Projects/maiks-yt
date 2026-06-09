# Inviting Community Without Forced Signup

## Idea

Users should feel encouraged to join the website and community, but not forced.

Guests should still be able to participate in meaningful ways, while logged-in users receive clear benefits:

- claim support history from platforms
- choose where eligible contributions go
- manage profile visibility
- display supporter recognition
- link Discord and other accounts
- receive perks or ranks
- trace money flow
- follow project updates
- customize themes and identity

## Why It Matters

The goal is to build a community, not trap users behind account walls. People should feel like joining is useful, fair, and welcoming.

This also matches the larger transparency philosophy: users should have more control when they sign up, not less freedom when they do not.

## UX Principle

The site should use positive incentives instead of pressure.

Good pattern:

- "Sign in to claim this support and choose where it goes."

Bad pattern:

- "You must sign in or your support does not matter."

## Data Needed

- guest contribution records
- claimable support events
- account linking status
- profile settings
- community roles
- perks and entitlements
- notification preferences

## Build Requirements

- guest-friendly public flows
- clear account benefits
- claimable contribution flow
- first-sign-in privacy choice
- optional profile visibility
- welcoming onboarding
- no unnecessary signup gates
- privacy-first defaults
- transparent wording around what guests can and cannot do

## Type-safety Notes

Guest and registered-user actions should be separate typed states. A guest contribution, claimed contribution, and registered-user donation may have different permissions and follow-up actions.

## Open Questions

- Which actions should guests be allowed to take?
- Which actions require an account for safety or legal reasons?
- Should guest donations be claimable forever or expire after a period?
- How should the site explain account benefits without sounding pushy?
- Should first sign-in show an obvious profile visibility toggle, then keep the same choice available in settings?
- Should Discord joining be encouraged during onboarding, or kept as an optional later step?
