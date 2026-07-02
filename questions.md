# Questions

These questions should not block the next implementation pass unless a default is unsafe.
Answer below each item when convenient.

## 1. Discord Chat Intake Channel

Which Discord guild channels should be read into the private streamer chat feed first?

Default if unanswered: use the configured dev guild and add an owner/admin status surface that reports available channels, but do not ingest messages until a channel allowlist exists.

Answer: use default for now we need to create a new structure in discord at a later time.


## 2. Discord Message Scope

Should Discord intake include only normal text messages, or also thread messages and forum posts?

Default if unanswered: normal text channels only for the first slice.

Answer: I want to have a live chat channel once we get to that point this channel should be send to chat in the overlay. I think I'm going to stream to that channel and only give access to a certain group/level. maybe as a reward?


## 3. Moderator Window First Panels

For the first `/moderation` window, which panels should be available behind the top dropdown?

Default if unanswered: Chat, Applied Rules, Pending Approvals, Live Helper Summary.

Answer: default


## 4. Moderator Emergency Clear

Should `chat:emergency-clear` be visible in the first moderator window for ranks that have the right, or kept creator-only until we test with real helpers?

Default if unanswered: show it only to roles with `chat:emergency-clear`, with clear warning copy.

Answer: visable


## 5. Provider Warning Messages

When provider-write moderation opens later, should a warning message be posted publicly in the original platform chat, privately as a DM if supported, or both where possible?

Default if unanswered: public chat warning only, because it is visible to moderators and easier to audit.

Answer: publicly, if you do dumb things online you should be called out for it.


## 6. YouTube Timing

When you are ready for YouTube, do you want the first test to target a scheduled private/unlisted stream, or a normal public live stream?

Default if unanswered: wait until Michael explicitly starts a YouTube live-test session.

Answer: private first, then maybe unlisted and ask someone to help if needed. by the time we are ready to go live with the app on the public version we'll do test streams publicly

