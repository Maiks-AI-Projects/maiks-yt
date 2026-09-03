# Pre-show Countdown Broadcast Handoff

## Idea

Run the public countdown and waiting period on a temporary YouTube broadcast, then hand viewers to the actual scheduled broadcast immediately before the real introduction begins.

The actual broadcast would therefore start with a clean introduction instead of containing the full countdown in its archived video. OBS could keep using one reusable YouTube `liveStream` and stream key if a proven handoff allows the temporary and actual `liveBroadcast` objects to share that ingest safely.

## Why It Might Be Useful

- Keep the permanent stream video focused on the actual show.
- Exclude countdown, waiting, setup delay, and late-start time from the main archive.
- Give viewers a clear transition from waiting room to the real stream.
- Reuse the same future handoff infrastructure needed for multipart or very long streams.

## Possible Future Flow

1. Maiks.yt creates or selects the temporary countdown broadcast and the actual scheduled broadcast.
2. Both are prepared against a verified reusable YouTube live stream.
3. OBS sends the countdown scene to the temporary broadcast.
4. Before the show, Maiks.yt verifies that the actual broadcast, destination URL, chat, and viewer handoff are ready.
5. OBS switches to a neutral handoff scene while the actual broadcast becomes live.
6. The temporary broadcast ends and eligible viewers are redirected to the actual broadcast.
7. After the destination is confirmed, OBS starts the clean show introduction.

## Dependencies and Gates

- Do not build or test this yet.
- First complete and verify the shared YouTube broadcast-handoff infrastructure.
- Prove the transition privately or unlisted from both operator and viewer perspectives.
- Confirm that the channel has reached YouTube's Live Redirect eligibility threshold of more than 1,000 subscribers and has no blocking Community Guidelines strikes.
- Verify that Live Redirect supports the intended same-channel destination and measure its real delay and failure behavior.
- Preserve a visible destination link or QR code, holding scene, abort action, and manual recovery when redirect is unavailable or incomplete.
- Verify the old and new `liveChatId` lifecycle and switch Maiks.yt chat intake without losing, mixing, or duplicating messages.
- Never start, end, bind, or transition a public broadcast automatically until the exact operator action and recovery contract is separately approved.

## Open Questions

- Can the temporary and actual broadcasts overlap on Michael's channel while sharing one reusable stream?
- Does Live Redirect work from a temporary broadcast to another broadcast on the same channel?
- Can Live Redirect be configured through a supported API, or must Michael prepare it in YouTube Studio?
- How long does viewer redirection take on desktop, mobile, TV, and embedded players?
- Should the countdown broadcast be unlisted until shortly before the scheduled start?
- What should viewers see when the actual broadcast cannot be made ready?
- Should the temporary countdown archive be retained, made unlisted, or removed only through a later explicit retention policy?

## References

- [YouTube broadcasts and streams](https://developers.google.com/youtube/v3/live/broadcasts-and-streams)
- [YouTube Live Redirect](https://support.google.com/youtube/answer/10359590)

