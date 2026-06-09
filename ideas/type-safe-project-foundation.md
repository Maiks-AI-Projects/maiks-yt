# Type-safe Project Foundation

## Idea

Build the website and overlay as a fully type-safe TypeScript project from the beginning.

The system should keep shared data models, API contracts, database schema, and overlay event types aligned so the same concepts are not rewritten differently in multiple places.

## Why It Matters

This project will likely handle money, identity, platform integrations, and live overlay events. Strong typing reduces accidental mismatches and makes it easier to grow the system without breaking hidden connections.

## Data Needed

- shared domain models
- typed API contracts
- typed database schema
- typed event definitions
- typed theme definitions
- validation schemas for external input

## Build Requirements

- TypeScript throughout
- runtime validation for untrusted input
- shared package for common types
- database access with generated or inferred types
- tested money and ledger logic
- typed real-time overlay events

## Possible Stack Direction

One possible direction:

- TypeScript
- Next.js or another full-stack TypeScript framework
- PostgreSQL
- Prisma or Drizzle
- Zod, Valibot, or similar runtime validation
- tRPC, typed server actions, or OpenAPI-generated clients
- WebSocket or server-sent events for overlays

This is not a final recommendation yet. The stack should be chosen after the idea cards are clearer.

## Open Questions

- Should this be a monorepo from day one?
- Should the overlay and website be separate apps sharing packages?
- Which database style feels best for the long-term project?
- How much should be self-hosted versus handled by managed services?
- Which payment provider is realistic for direct donations and credits?
