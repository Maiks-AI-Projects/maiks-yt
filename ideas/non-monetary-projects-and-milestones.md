# Non-monetary Projects and Milestones

## Idea

Projects should not always require money. Some projects are work plans, stream arcs, build logs, or creative goals.

Example: this website and overlay system itself could become a public project with milestones, progress updates, and stream sessions linked to the work.

Possible non-monetary projects:

- building the stream website
- creating overlay themes
- learning a game system
- completing a game challenge
- building a software tool
- organizing a community event
- documenting a hobby project

## Why It Matters

This lets the website track what the streamer is doing, not only what viewers are funding.

It can turn long-term work into visible progress, give streams a clear purpose, and help viewers follow along even when there is no donation goal attached.

## Data Needed

- project type
- milestones
- tasks or checklist items
- progress status
- linked stream sessions
- updates/changelog
- optional funding fields
- visibility settings
- completion/archive state

## Build Requirements

- project model where funding is optional
- milestone tracking
- task/checklist support
- project update posts
- link streams to projects/milestones
- overlay widget for current project progress
- archive completed non-monetary projects
- optional conversion from non-funded project to funded project later

## Stream Use

When working on a large project during streams, the project can become the active stream focus.

The overlay could show:

- current project
- current milestone
- progress percentage
- next task
- recent completed milestone

## Type-safety Notes

Funding data should be optional and explicit. A project without funding should not need donation, ledger, or withdrawal fields.

Project progress should have its own typed model instead of borrowing money-goal fields.

## Open Questions

- Should every project have milestones, or only larger ones?
- Should viewers be able to follow or like non-monetary projects?
- Should non-monetary projects appear beside donation projects or in a separate section?
- Can a non-monetary project later add funding for specific items?
- Should project progress updates trigger overlay notifications?
