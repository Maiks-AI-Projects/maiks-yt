# Flexible Project Types

## Idea

Projects should support different real-world purposes, not only tech purchases or donation goals.

Examples:

- buying clothes for your son
- building a new PC
- funding a single GPU
- paying ongoing subscription costs
- buying stream gear
- funding a hobby project
- covering software or hosting costs
- building a software project on stream
- tracking milestones for a non-funded creative or technical project

Some projects are one-time goals. Others are recurring or ongoing costs. Some projects do not involve money at all and only track progress, milestones, or stream work.

## Why It Matters

The site should reflect how life and streaming actually work. Not every project is a neat one-time product purchase, and not every project is a funding request.

Allowing different project types makes the system useful for personal, creative, technical, operational, and community needs without forcing them into the same shape.

## Data Needed

- project type
- project category or purpose
- optional funding target
- one-time or recurring mode
- expected cost if funded
- current cost if funded
- milestones
- progress updates
- linked stream sessions
- funding period
- renewal period for ongoing costs
- spending records
- project status
- visibility settings

## Build Requirements

- project type model
- project category model
- one-time funding goals
- recurring/ongoing funding goals
- non-monetary milestone projects
- project status workflow
- UI differences for one-time and ongoing projects
- UI differences for funded and non-funded projects
- rules for overflow and underfunding
- admin tools to close/archive projects

## Possible Project Types

- `oneTimePurchase`
- `multiItemBuild`
- `personalNeed`
- `ongoingCost`
- `subscription`
- `experiment`
- `communityGoal`
- `streamWorkProject`
- `milestoneOnly`

## Type-safety Notes

Project types should probably be a discriminated union. A subscription project needs different fields than a one-time item purchase, and a non-monetary milestone project should not require funding or ledger fields.

Project categories should be modeled separately from project types. Type describes the shape of the project; category describes the reason for it.

## Open Questions

- Should personal projects look different from stream/content projects?
- Should projects allow one category or multiple categories?
- Should some project types allow revocation for longer than others?
- Should ongoing costs have monthly funding targets?
- Can one project contain both one-time items and recurring costs?
- Can one project contain both non-monetary milestones and funded items?
