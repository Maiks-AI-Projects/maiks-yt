# Stream Overlays and Notifications

## Overlay Design
- **Reusable Components**: Modular UI elements (e.g., goal bars, alert boxes, event lists) that can be easily customized and rearranged.
- **Scene-Specific Layouts**:
  - **In-Game**: Minimalist overlay focusing on gameplay with discrete notifications.
  - **Talking**: Layout emphasizing the creator's webcam, chat feed, and community engagement.
  - **BRB/Intro/Outro**: Informative layouts with timers and social media links.

## Comprehensive Control Panel
A unified dashboard for managing the stream experience:
- **Combined Chat**: A unified chat feed that integrates YouTube, Twitch, and other platforms.
- **Moderation Actions**: Instant moderation (e.g., ban, timeout, delete message) from the same interface.
- **Overlay Management**: Real-time control over which elements are visible on the stream.

## Integration
- **Engagement Triggers**: Streamers can trigger specific animations or sounds via the dashboard.
- **WebSockets**: Real-time data updates for low-latency notifications and overlay changes.

## Technical Details
- Built with HTML/CSS/JS (Tailwind CSS for styling) for OBS integration (Browser Source).
- Modular architecture for easy updates and new component additions.
