# Wishlist Integrations

## Idea

Create wishlists that can be linked to project items.

The site could support an internal wishlist and, later, integrations with wishlist providers or store wishlists such as Amazon and other shops.

Wishlist items can be connected to:

- donation project items
- non-funded project supplies
- stream gear
- personal/family needs
- content improvement goals
- hobby items

## Why It Matters

Many streamers already use wishlists because they are simple for viewers to understand. Integrating wishlists with projects keeps that convenience while preserving the site's transparency and tracking.

A wishlist item can become a project item, and a project item can link back to where it can be bought.

## Data Needed

- wishlist entries
- wishlist provider
- external wishlist URL
- linked product URL
- linked project/item
- item title
- item image
- price if available
- priority
- purchased/fulfilled status
- donor/gifter visibility if known
- shipping/privacy constraints

## Build Requirements

- internal wishlist page
- admin wishlist manager
- ability to link wishlist entries to project items
- wishlist item status tracking
- provider integration system
- Amazon wishlist support if feasible
- other wishlist/store providers if feasible
- price/product data connection where available
- public disclosure around wishlist purpose
- privacy handling for delivery/shipping information

## Provider Strategy

Start with an internal wishlist model first. External providers can be added later as adapters.

Amazon and Dutch stores may be useful, but wishlist integrations can be fragile if providers do not offer stable APIs. Where official APIs or affiliate/product feeds exist, prefer those.

## Type-safety Notes

Wishlist entries should be separate from project items, but linkable. A project item may have zero, one, or multiple wishlist/product sources.

Provider records should be typed so the app can distinguish internal wishlist items, Amazon wishlist items, direct product links, and manually entered items.

## Open Questions

- Should viewers be able to buy wishlist items directly instead of donating money?
- If someone buys an item externally, how is that verified?
- Should external wishlist purchases appear in public project archives?
- Should wishlist gifts trigger overlay notifications?
- Which providers should be supported first?
- How should shipping privacy be protected?
