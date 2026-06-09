# Store Product Links and Price Tracking

## Idea

Allow projects and items to link to products from a small set of supported stores. The system can track price changes so goal amounts stay realistic.

Example: if a GPU goal is based on a 2000 euro listing, the site should notice if the price rises or falls. This reduces awkward situations where the goal is reached but the item now costs more, or where the price dropped and there is a surplus.

Initial supported stores could be limited to three or four sources, such as Amazon and selected Dutch tech stores.

Product links can also connect to wishlist entries, so an item may have a donation goal, direct store link, wishlist link, or several possible purchase sources.

## Why It Matters

Many project goals depend on real product prices. Price tracking makes goals feel honest and current.

It also helps explain changes: users can see whether a goal changed because the store price changed, shipping changed, availability changed, or a different product was selected.

## Data Needed

- store providers
- product URLs
- product title
- current price
- previous prices
- currency
- availability
- shipping estimate if available
- last checked time
- price source confidence
- manual override values
- target project/item
- linked wishlist entry if relevant

## Build Requirements

- supported store provider system
- product link parser
- wishlist/product source linking
- scheduled price checks
- price history
- project goal recalculation rules
- alerts for major price changes
- manual price override
- public price-change history
- fallback when a store blocks scraping or changes layout

## Possible Store Strategy

Start with a small allowlist:

- Amazon
- one or two Dutch tech stores
- one general Dutch retailer if useful

Prefer official APIs or affiliate/product feeds where available. If scraping is needed, it should be treated as fragile and provider-specific.

## Type-safety Notes

Each store should be a typed provider with a shared output shape. The rest of the app should not care whether a price came from Amazon or a Dutch tech store.

## Open Questions

- Which three or four stores should be supported first?
- Should prices update automatically on a schedule or only when manually refreshed?
- Should goal amounts update automatically, or require approval after a price change?
- Should price drops automatically create surplus credits after purchase, or only after project completion?
- Should price tracking include shipping, import fees, warranty, and discounts?
- What happens when the item goes out of stock?
- Should wishlist links be tracked the same way as direct product links?
