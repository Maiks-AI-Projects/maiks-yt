# Creator Hub Links and Feeds

## Idea

Build a creator hub page that works like a self-owned Linktree, plus feed/syndication features such as RSS.

Possible features:

- public links page
- social links
- current stream link
- latest blog posts
- stream schedule
- active project or stream goal
- donation/support links
- Discord/community link
- profile/about/context links
- RSS feed for blog posts
- RSS feed for project updates
- RSS feed for stream schedule changes

## Why It Matters

Viewers arrive from many places. A simple links hub gives them one reliable place to find the current stream, socials, Discord, schedule, projects, and updates.

RSS and similar feeds make the site more open. People can follow updates without needing a specific platform, algorithm, or account.

## Data Needed

- link entries
- link groups
- display order
- visibility settings
- active/current link state
- blog posts
- project updates
- stream schedule entries
- feed metadata
- canonical URLs

## Build Requirements

- editable links hub page
- per-channel or per-theme link sets
- public RSS feed for blog posts
- optional RSS feeds for project updates and stream schedule
- Open Graph/social preview metadata
- bot-command-friendly short links
- admin controls for ordering and visibility
- optional analytics for link clicks

## Type-safety Notes

Links should be typed by purpose, such as `social`, `stream`, `support`, `community`, `project`, `schedule`, `blog`, or `custom`. Feeds should have typed source collections so a blog RSS feed cannot accidentally include private drafts.

## Open Questions

- Should every landing page have its own links hub, or one global hub?
- Should the links page theme match the visitor's landing theme?
- Which feeds are needed first: blog, projects, schedule, or all three?
- Should link click analytics be public, private, or disabled?
- Should short links be generated for bot commands?
