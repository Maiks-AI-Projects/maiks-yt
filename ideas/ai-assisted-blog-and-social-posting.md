# AI-assisted Blog and Social Posting

## Idea

Create an AI-assisted blog system where the streamer can dump raw information, notes, updates, or stream thoughts, and the system turns them into a readable blog post.

The post can then be reviewed, edited, approved, published on the website, and linked through selected social accounts.

Possible inputs:

- rough notes
- voice transcript
- stream recap
- project update
- health/context update
- cancellation explanation
- milestone progress
- personal story draft
- sponsor-safe announcement

## Why It Matters

Writing polished updates can take a lot of energy. This lets the streamer communicate more consistently without needing to start from a blank page every time.

It also gives the website more life. Streams, projects, health updates, milestones, and community decisions can become visible public posts that are easy to share.

## Data Needed

- raw draft input
- AI-generated draft
- edit history
- approval status
- blog post title
- slug
- tags/categories
- related projects or streams
- publication status
- social share status
- translation/localization status if needed

## Build Requirements

- raw note/draft input page
- AI draft generation
- tone/style presets
- editor for review and changes
- approval step before publishing
- blog post publishing
- links to related projects, streams, goals, or personal context pages
- social post generation
- social publishing or copy-ready social drafts
- action panel integration for pending posts

## Social Sharing

After approval, the system can generate short posts for linked social platforms.

Examples:

- "New update: [title] [link]"
- stream recap thread
- project milestone update
- cancellation context link
- sponsor-safe announcement

Social posts should be generated per platform because length, tone, and formatting differ.

## Translation

If useful, the system could draft posts in one language and translate them to another. The translated version should also require review before publishing.

## Type-safety Notes

AI-generated content should have explicit states, such as `rawInput`, `drafted`, `needsReview`, `approved`, `published`, and `shared`.

Publishing events and social share events should be tracked separately so a blog post can publish successfully even if one social platform fails.

## Open Questions

- Should blog posts be public immediately after approval, or schedulable?
- Which languages should be supported?
- Should posts support both short and long versions?
- Should social publishing be automatic after approval, or always manual?
- Should the AI learn a personal writing style from approved posts?
- Which post types are too sensitive to publish without extra review?
