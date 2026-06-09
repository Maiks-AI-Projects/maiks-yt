# CSS-based Stream Themes

## Idea

Make stream themes mostly or entirely CSS-based, so different games, hobbies, and channel identities can load different theme files without changing overlay logic.

Themes can affect:

- colors
- typography
- borders and spacing
- notification animations
- chat styling
- sponsor frame styling
- camera frame styling
- background effects for non-game scenes

## Why It Matters

This keeps the overlay system flexible. A layout can stay the same while the stream changes visual identity based on the game or hobby.

It also makes it easier to add new stream categories later without rewriting components.

## Data Needed

- theme identifiers
- theme CSS files
- theme metadata
- default theme per game/hobby/channel
- user or streamer theme overrides
- asset references used by themes

## Build Requirements

- theme loader
- CSS variable contract
- theme preview page
- fallback theme
- validation that required CSS variables exist
- optional hot-switching during a stream

## Type-safety Notes

Even if themes are CSS files, the available theme IDs and required CSS variables should be typed. A TypeScript theme manifest can declare the CSS file, display name, supported layouts, and required assets.

## Open Questions

- Should themes be plain CSS, CSS modules, Tailwind layers, or generated from typed design tokens?
- Should theme changes happen instantly on active overlays?
- Can themes include custom animations, or should animations be part of the layout system?
- Should community-made themes ever be allowed?
