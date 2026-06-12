# Privacy, Data Retention, and Account Deletion

## Idea

Create clear privacy and data retention rules, including a delete account button.

When a user deletes their account, identifiable information should be deleted or anonymized. If the user made donations or support actions that must remain in the ledger, those records become anonymous and unrecoverable as that person's records.

## Why It Matters

The site touches OAuth, donations, credits, chat logs, private messages, health/context pages, profiles, Discord links, and platform support history. Users need clear control over their data.

## Data Needed

- user identity data
- linked account data
- profile data
- chat/profile visibility data
- donation ledger references
- anonymization status
- deletion requests
- deletion completion logs

## Build Requirements

- account delete button
- deletion confirmation flow
- anonymization process for ledger records
- unlink all OAuth/platform accounts
- delete profile and personal settings
- delete or anonymize chat/profile/event references where possible
- privacy policy page
- data retention policy page
- admin audit record that does not preserve unnecessary personal data

## Deletion Principle

After deletion, ledger entries that must remain for transparency or accounting should show as anonymous. The original user link should not be recoverable through normal systems.

Backups are different from the live system. A deleted account may still exist inside older backups until those backups naturally rotate out. Backups are for disaster recovery and rare abuse/admin-mistake recovery cases, not a public restore feature.

The site should not advertise backup restores as a normal user option, because deletion should feel final in the live system and people should not be encouraged to make backup-specific deletion requests.

## First Implementation Shape

The first live implementation should be conservative and explicit:

- require a signed-in user
- require a confirmation phrase before deleting
- set the domain user display name to `Anonymous user`
- set profile visibility to `private`
- remove avatar/profile image references from the domain profile
- mark the domain user as deleted with `deleted_at`
- remove or revoke Better Auth sessions for that auth user
- remove OAuth auth account rows and domain linked account rows
- keep only minimal non-identifying deletion audit data
- anonymize future ledger/support references once those tables exist

This should not be exposed as a casual settings toggle. It belongs in a danger zone with clear wording and no dark patterns.

## Rare Recovery Case

If a trusted helper, partner, or compromised admin account deletes someone else's account improperly, backups may allow the owner to investigate and restore the account.

That should be treated as an exceptional admin recovery process, not as something normal users can request after intentionally deleting their own account.

## Open Questions

- Which data must be deleted immediately?
- Which data must be retained for security, fraud, or legal reasons?
- How long should chat logs be kept?
- Should deleted users be allowed to reclaim accounts later, or is deletion final?
- How long should backups be retained before deleted data naturally disappears from them?
