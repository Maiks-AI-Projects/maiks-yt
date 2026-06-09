# Transparent Affiliate Pages

## Idea

Create affiliate pages with clear messaging that affiliate links are an income source, not automatically product recommendations.

The page should make the distinction obvious:

- affiliate link: supports the streamer if used
- recommendation: the streamer actively recommends it
- personally used: the streamer has used or owns it
- sponsor/ad: paid placement or campaign

## Why It Matters

Affiliate links can help fund the stream, but they can also damage trust if they look like hidden recommendations.

Clear disclosure keeps the system honest and gives viewers enough context to decide whether they want to use the links.

## Data Needed

- affiliate partners
- affiliate links
- disclosure text
- link category
- recommendation status
- personally-used status
- sponsor/ad status
- click analytics if enabled
- related projects or gear

## Build Requirements

- affiliate link manager
- public affiliate pages
- clear disclosure components
- labels for affiliate/recommended/used/sponsored
- optional link click tracking
- relation to creator hub links
- relation to sponsor/ad telemetry if needed
- admin controls for editing and disabling links

## Disclosure Principle

Affiliate pages should not imply that every listed product is recommended.

Example wording:

"Some links on this page are affiliate links. They may support the stream if you use them. That does not automatically mean I recommend every listed product."

## Type-safety Notes

Affiliate links should have explicit typed flags for `isAffiliate`, `isRecommended`, `isPersonallyUsed`, and `isSponsored`. The UI should render labels from these flags rather than relying on manual wording.

## Open Questions

- Should affiliate links be grouped by platform, product type, or stream relevance?
- Should personally recommended products live on a separate page from general affiliate links?
- Should click analytics be collected, and should that be public or private?
- Should affiliate links be allowed inside bot commands and periodic messages?
- Should affiliate income be included in public transparency reports?
