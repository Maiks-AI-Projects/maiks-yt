# Scene-based Overlay Layouts

## Idea

Create multiple overlay layouts for different OBS scenes and stream formats.

Examples:

- gameplay with camera in the corner
- gameplay with camera moved away from game UI
- full-screen camera scene
- starting soon
- be right back
- intermission/chatting
- sponsor-heavy break scene
- stream ending

Layouts should know where chat, notifications, camera, sponsor spots, and other widgets are allowed to appear so they do not overlap each other or important game/video content.

## Why It Matters

Different games and hobbies place important information in different areas of the screen. A single static overlay will eventually cover something important.

Scene-based layouts let the stream look polished while still being practical during actual gameplay.

## Data Needed

- overlay layouts
- OBS scene names or scene identifiers
- widget positions
- safe areas
- camera slots
- sponsor slots
- notification zones
- active layout state
- per-game layout defaults

## Build Requirements

- layout configuration system
- overlay renderer that can switch layouts live
- scene-to-layout mapping
- preview/test page
- collision avoidance rules for chat, camera, ads, and notifications
- optional OBS integration for scene detection

## Type-safety Notes

Layouts should use typed widget zones instead of arbitrary CSS pasted everywhere. A layout can expose named slots such as `topAlert`, `centerAlert`, `chatPanel`, `cameraPrimary`, `cameraAlt`, and `sponsorBanner`.

## Open Questions

- Should OBS scene changes automatically switch layouts?
- Should layouts be edited visually or through config files first?
- How many camera positions are needed for the first version?
- Should each game have its own default layout, or should layouts be reusable across games?
