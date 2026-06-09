# Backup, Export, and Admin Recovery

## Idea

Because the site may become the central stream brain, it needs strong backup, export, and recovery options.

The preferred direction is a local MySQL database with a backup database.

Backups should support disaster recovery and rare improper-deletion cases, such as a trusted helper, partner, compromised account, or admin mistake deleting someone else's account.

## Why It Matters

The system may hold schedules, overlays, projects, user links, donations, blog posts, sponsor telemetry, stream bot commands, and transparency records. Losing that would hurt the stream and community.

## Data Needed

- database backups
- backup status
- restore points
- export records
- admin recovery logs
- critical config backups

## Build Requirements

- local MySQL database
- backup database or backup target
- automated backups
- manual backup button
- restore process
- rare account restore process for improper deletions
- export tools for key data
- backup health checks
- disaster recovery notes

## Open Questions

- How often should backups run?
- Where should backups be stored?
- Should backups be encrypted?
- What is the recovery process if the main server fails?
- How long should backups be retained?
- Who is allowed to perform rare account restores?
