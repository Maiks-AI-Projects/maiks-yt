# Live AI Stream Assistant

## Idea

Add a live AI assistant that can listen to chat and support the stream with voice output.

Possible behaviors:

- read paid messages out loud
- read selected chat messages out loud to both the streamer and the stream
- announce Twitch Bits, donations, raids, hype trains, and similar events
- summarize chat when it becomes overwhelming
- ask game-related or chat-related questions when the streamer goes quiet
- use preapproved prompt lists for stream-safe questions
- make occasional funny remarks
- read occasional sponsored messages without overdoing it
- optionally ask a public stream-end wellness checkpoint when the streamer seems tired
- show non-spoken summaries in the control panel when useful
- read private viewer messages privately only when they are actually private messages
- announce private messages publicly without revealing the content
- optionally speak on-stream

Gemini 3 Live is one possible provider if it is free and suitable, especially if it can avoid interrupting while the streamer is speaking. Alternatives should stay open, especially for voice quality, latency, safety, interruption handling, and personality control.

For a Satisfactory stream, the desired personality could be a sarcastic factory/automation assistant inspired by ADA's style, without cloning a copyrighted character voice exactly.

## Why It Matters

Streaming solo can create dead air, and fast chat can become impossible to follow. A live AI assistant could help keep the stream moving, surface important messages, and make the experience feel more interactive.

This is also an accessibility and stream-continuity feature. If the streamer has health-related moments where speaking or tracking chat becomes harder, the assistant can help maintain engagement without forcing constant manual performance.

## Data Needed

- chat messages
- paid message events
- selected chat readout events
- donation events
- raid/hype train/platform events
- streamer silence/activity state
- AI mode setting
- voice output target
- sponsor message rules
- approved prompts/questions
- blocked topics and safety rules
- per-game personality settings
- stream-end wellness checkpoint settings
- start instructions and provider settings
- draft/shadow output logs for review

## Build Requirements

- AI provider integration
- text-to-speech or live audio output
- chat summarization pipeline
- shared chat readout heard by the streamer and the stream
- event prioritization
- silence detection or manual prompt trigger
- interruption avoidance while the streamer is speaking
- streamer wellness/low-energy mode
- optional public wellness checkpoint for ending soon
- on-stream voice output
- non-spoken control panel summaries
- private audio only for genuinely private viewer messages
- private message preamble so the streamer knows the content is private
- moderation/safety filters
- sponsor frequency limits
- voice/personality presets
- editable start instructions
- optional draft/shadow mode for tuning without public output
- control panel toggles

## Private Output Boundary

The assistant should not whisper general guidance, summaries, or prompts privately during a live stream. That can create awkward moments where the streamer replies to something the audience did not hear.

Private audio should be reserved for private viewer messages or other events that are already private by nature. General AI support should either be public-safe on-stream speech or non-spoken text in the control panel.

The assistant should reduce social load, not create a hidden conversation the streamer has to explain.

When the assistant reads chat, that readout should be audible to both the streamer and the stream. This keeps the audience included and avoids the streamer reacting to audio the viewers cannot hear.

For private viewer messages, the assistant can make a public-safe announcement such as "A private message from [name]" without revealing the topic or content. Then, before reading the private content to the streamer, it should clearly state that the message is private so the streamer knows not to accidentally disclose sensitive details.

This allows the streamer to reply out loud in a privacy-preserving way, such as answering generally without exposing the private topic.

## No Nagging Rule

The assistant should not act like a timer that tells the streamer to talk. Quiet-moment support should be context-aware and low-pressure, such as asking chat a public question, summarizing chat, or making an allowed public comment.

## Tuning and Draft Mode

Public AI models should not be treated as if they learn permanently from the stream. The practical tuning path is editable start instructions, provider settings, approved prompt lists, and reviewable draft behavior.

An optional draft/shadow mode can show what the AI would have said in the control panel or action panel without speaking publicly. This is useful for tuning instructions and safety rules before enabling a new behavior on stream.

## Optional Stream-end Checkpoint

The assistant may have an opt-in mode where it can gently ask, on stream, whether it is wise to start wrapping up if the streamer seems tired.

Example: "You seem a bit tired. Would it be smart to wrap up after this part?"

The streamer can then answer naturally, such as "No, I want to finish this" or "Yeah, let's go until here."

This should be rare, configurable, and easy to disable. It should not publicly diagnose the streamer, pressure them, or make health assumptions too bluntly.

## Type-safety Notes

AI actions should be typed separately from overlay notifications. For example, `readPaidMessage`, `summarizeChat`, `askQuestion`, `announceRaid`, and `sponsorLine` can each have strict payloads and permission rules.

## Open Questions

- Which AI actions are public speech, control-panel text, or private-message audio?
- Which chat messages are eligible for public readout?
- How should interruption avoidance work if the streamer starts speaking mid-readout?
- What public wording should be used when a private message arrives?
- Should private messages require manual approval before private readout?
- What should trigger the AI when the streamer falls silent?
- Should there be a low-energy mode with more proactive summaries and prompts?
- Should the stream-end wellness checkpoint be manual-only, AI-suggested, or both?
- What wording feels supportive without feeling intrusive?
- How often is "not too often" for jokes and sponsored lines?
- Should paid messages always be read, or can they be skipped by moderation?
- Which AI provider gives the best combination of cost, latency, voice quality, and control?
- Should each game/hobby have a different AI personality preset?
- Which AI behaviors should support draft/shadow mode before public use?
- How should start instructions be edited and versioned?
