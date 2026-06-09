# Donation Goals With Nested Projects and Items

## Idea

Build a donation system where guests and logged-in users can donate toward goals. Goals can represent projects or specific items.

Projects can contain:

- child projects
- purchasable items
- funding goals
- progress totals
- overflow rules

Items can be nested inside projects so a larger build can be broken down into understandable parts.

## Why It Matters

This makes donations feel concrete. Instead of a vague support button, people can help fund specific things they care about and see how those pieces fit into larger plans.

It also gives stream content a natural feedback loop: viewers can fund things that later become streams, videos, experiments, or community milestones.

## Data Needed

- projects
- project hierarchy
- items
- item prices
- donation transactions
- donor identity or guest identity
- project funding totals
- overflow destination rules
- project status, such as planned, active, funded, purchased, completed, cancelled

## Build Requirements

- donation checkout flow
- project and item management
- nested project tree display
- funding progress calculations
- audit trail for transactions
- admin controls to mark projects/items as purchased or completed
- clear public explanation of where money goes

## Type-safety Notes

The project tree should use explicit types for project nodes, item nodes, and donation allocations. Money should be stored in integer minor units, such as cents, not floating point values.

## Open Questions

- Which payment processor should be used?
- Can guests donate anonymously?
- Can a donation be split across multiple items or projects?
- What happens if an item's real-world price changes after people donate?
- Should shipping, tax, and payment fees be included in goal amounts?
