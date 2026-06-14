# Scene-based Overlay Layouts

## Idea

Create multiple overlay layouts for different OBS scenes and stream formats.

The scene designer should let the streamer move and resize standard overlay elements visually, then save those positions as named scenes. Scenes belong to a theme. The theme owns the styling, while the scene owns the layout data.

This allows generic ad-hoc streams to use a default theme and general-purpose scenes, while specific games or topics can have specialized themes with their own saved scenes.

OBS still owns the real camera source, game capture, desktop capture, and background media. The overlay scene designer owns web-controlled elements and reservation slots, so OBS scenes can be built around those stable positions.

Examples:

- gameplay with camera in the corner
- gameplay with camera moved away from game UI
- full-screen camera scene
- starting soon
- be right back
- intermission/chatting
- sponsor-heavy break scene
- stream ending
- styled just-talking scene for important moments
- game-specific chat focus scene
- low-distraction clean scene

Layouts should know where chat, notifications, camera, sponsor spots, and other widgets are allowed to appear so they do not overlap each other or important game/video content.

## Why It Matters

Different games and hobbies place important information in different areas of the screen. A single static overlay will eventually cover something important.

Scene-based layouts let the stream look polished while still being practical during actual gameplay.

They also make it possible to switch from gameplay to a more focused talking scene when something important needs to be said. For example, a game-specific talking scene can show the camera larger, make chat easier to read, keep sponsor messaging visible, and preserve notifications without fighting the game view.

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
- theme-to-scene ownership
- saved scene position data
- element size data
- element visibility flags
- optional lock/aspect-ratio settings

Example shape:

```ts
{
  themeKey: "satisfactory",
  sceneKey: "talking",
  slots: {
    camera: { x: 64, y: 120, width: 640, height: 360, visible: true },
    chat: { x: 1320, y: 140, width: 500, height: 720, visible: true },
    sponsorPrimary: { x: 690, y: 820, width: 540, height: 90, visible: true },
    topNotifications: { x: 0, y: 0, width: 1920, height: 64, visible: true },
    centerNotifications: { x: 600, y: 300, width: 720, height: 240, visible: true }
  }
}
```

## Build Requirements

- layout configuration system
- overlay renderer that can switch layouts live
- scene-to-layout mapping
- preview/test page
- visual scene designer with drag controls
- resize handles for standard elements
- numeric inputs for exact position and size
- snap-to-grid support
- duplicate scene action
- reset slot action
- hide/show slot action
- lock aspect ratio option for camera-like slots
- collision avoidance rules for chat, camera, ads, and notifications
- optional OBS integration for scene detection

## Slot Overlap Policy

- The game/video slot is treated as an underlay. Overlay slots may sit over the game slot without a warning.
- A visible slot outside the 1920x1080 canvas is a blocked issue and should not be saved by the API.
- Non-game visible slots overlapping each other are warnings in the designer. This includes camera, chat, sponsor spots, top notifications, center notifications, and stream goal.
- Warnings remain editable instead of hard-blocked because a special stream scene may intentionally layer elements, but the warning must stay visible until the layout is adjusted.
- Final OBS-ready scenes should have no non-game overlap warnings unless the overlap is a deliberate scene-specific exception.

OBS browser-source URLs should be able to select the saved scene and theme, for example:

```text
https://overlay-dev.maiks.yt/?theme=satisfactory&scene=talking
https://overlay-dev.maiks.yt/?theme=satisfactory&scene=gameplay-standard
https://overlay-dev.maiks.yt/?theme=minecraft&scene=chat-focus
```

## Type-safety Notes

Layouts should use typed widget zones instead of arbitrary CSS pasted everywhere. A layout can expose named slots such as `topNotifications`, `centerNotifications`, `chatPanel`, `cameraPrimary`, `cameraAlt`, and `sponsorBanner`.

Scenes should be stored as typed data, not hard-coded component variants. The renderer should accept a scene snapshot and apply the positions through a narrow layout engine.

Themes should not decide where elements go. Themes may provide default scenes, supported scene templates, and visual styling, but the saved scene data remains the source of truth for position, size, and visibility.

Standard slot IDs should be stable so OBS scene setup remains predictable:

- `camera`
- `chat`
- `sponsorPrimary`
- `sponsorSecondary`
- `streamGoal`
- `topNotifications`
- `centerNotifications`

## Open Questions

- Should OBS scene changes automatically switch layouts?
- Should layouts be edited visually or through config files first?
- How many camera positions are needed for the first version?
- Should each game have its own default layout, or should layouts be reusable across games?
- Should scene designer edits save immediately as drafts, or require an explicit save?
- Should scene data use pixels based on a 1920x1080 canvas, percentages, or a hybrid with a canonical canvas?
- Should control panel scene switching also be able to trigger OBS scene changes later?
