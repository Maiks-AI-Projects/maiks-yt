# Stream Scheduling and Cancellations

## Idea

Create an admin page for managing stream schedules across platforms.

The streamer can:

- create planned streams
- set title, category/game, description, thumbnail, and theme
- publish schedules to Twitch and YouTube where supported
- update stream times
- cancel streams when needed
- provide a cancellation reason
- optionally publish cancellation updates to social accounts
- optionally generate a longer blog/update post from the cancellation reason
- link the scheduled stream to a stream goal, layout, and theme

## Why It Matters

Scheduling should not become a stressful manual chore across multiple platforms. If a stream has to be cancelled because of health, family, energy, or life, the system should make that easy and respectful.

This also keeps viewers informed and reduces confusion.

## Data Needed

- stream schedule entries
- platform schedule IDs
- stream title
- stream description
- planned start/end time
- game/category/hobby
- theme/layout defaults
- linked stream goal
- cancellation status
- cancellation reason
- social posting status
- platform sync history

## Build Requirements

- stream schedule admin page
- Twitch scheduled stream integration
- YouTube scheduled stream integration
- platform sync and update handling
- cancellation flow
- cancellation reason templates
- optional AI-assisted cancellation/update draft
- social account posting integrations
- public schedule page
- overlay/control panel awareness of scheduled streams
- timezone handling

## Cancellation Flow

When cancelling a stream, the admin page should let the streamer enter a reason once.

The system can then:

- update the public website schedule
- update Twitch/YouTube scheduled stream status if supported
- publish a short cancellation message to selected social accounts
- create a longer website/blog update if needed
- optionally link to the public personal context section
- notify Discord if configured

## Type-safety Notes

Scheduled streams should be typed separately from live stream sessions. A scheduled stream can become a live session, be moved, or be cancelled.

Platform sync results should be tracked per platform so a failed YouTube update does not hide a successful Twitch update.

## Open Questions

- Which platforms should scheduling support first?
- Should Discord announcements be part of social posting?
- Should cancellation reasons be public text, private notes, or both?
- Should there be reusable cancellation templates?
- Should scheduled streams automatically set overlay theme/layout defaults?
- Should schedule changes require action panel approval, or happen immediately?
