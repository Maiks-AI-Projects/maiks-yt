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

Themes should own visual identity, not scene positioning. A theme can provide default scenes and supported scene templates, but the saved scene decides where elements live and how large they are.

This means an ad-hoc stream can use generic default styling, while a game or hobby can use a specialized theme with multiple saved scenes such as gameplay, talking, chat focus, and break.

## Data Needed

- theme identifiers
- theme CSS files
- theme metadata
- default theme per game/hobby/channel
- user or streamer theme overrides
- asset references used by themes
- supported scene templates
- default scenes bundled with a theme

## Build Requirements

- theme loader
- CSS variable contract
- theme preview page
- fallback theme
- validation that required CSS variables exist
- optional hot-switching during a stream
- theme manifest that lists available default scenes
- scene designer integration so new scenes can be saved under the active theme

## Type-safety Notes

Even if themes are CSS files, the available theme IDs and required CSS variables should be typed. A TypeScript theme manifest can declare the CSS file, display name, supported layouts, and required assets.

The theme manifest can also declare supported scene templates, but the scene layout data should stay separate from the CSS file.

## Open Questions

- Should themes be plain CSS, CSS modules, Tailwind layers, or generated from typed design tokens?
- Should theme changes happen instantly on active overlays?
- Can themes include custom animations, or should animations be part of the layout system?
- Should community-made themes ever be allowed?
