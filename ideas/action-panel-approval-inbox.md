# Action Panel Approval Inbox

## Idea

Create an action panel that shows things needing approval, review, or a decision.

This panel acts like a shared inbox for important actions instead of scattering approvals across many different pages.

Possible action items:

- approve suggested project goal changes after product price changes
- approve or reject donation revocation requests
- approve withdrawal records before publishing
- review project direction changes
- approve center-screen overlay notifications
- review flagged chat events
- approve sponsor display changes
- review AI-generated messages before they can be used
- confirm project completion/archive summaries

## Why It Matters

As the system grows, a lot of things should not happen silently. An action panel gives you one place to handle decisions without hunting through projects, overlays, donations, and settings.

It also makes the system safer. Automation can suggest actions, but important changes can wait for human approval.

## Data Needed

- action item type
- priority
- status
- created time
- due time if needed
- source entity, such as project, donation, overlay, sponsor, or AI assistant
- suggested action
- approval history
- reviewer identity
- decision notes

## Build Requirements

- action item model
- action panel page
- filtering by type/status/priority
- separate stream-safe and off-stream action queues
- urgent/live filters that avoid distracting the streamer during active streams
- approve/reject/defer actions
- decision notes
- audit history
- notifications for urgent actions
- role permissions
- links back to source records

## Relationship to Overlay Control Panel

The overlay control panel is for live stream operations.

The action panel is for review and approval work.

They may overlap for stream-time approvals, such as center-screen notifications, but they should not be treated as the same interface.

During streams, the action panel should be heavily sorted and filtered. Only truly urgent or stream-relevant actions should surface while live. Admin-heavy tasks should wait until off-stream review.

## Type-safety Notes

Action items should be typed by source and decision kind. For example, a `priceChangeApproval` action needs different payload data than a `donationRevocationReview` or `overlayAlertApproval`.

## Open Questions

- Which actions require approval in version one?
- Should urgent stream-time approvals appear in both the action panel and overlay control panel?
- What action categories are allowed to interrupt a live stream?
- Can moderators approve some action types?
- Should low-risk actions be auto-approved after a delay?
- Should action items expire if ignored?
