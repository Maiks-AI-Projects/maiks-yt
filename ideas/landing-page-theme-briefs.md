# Maiks.yt Landing Page Theme Briefs

This document contains proposed themes for Maiks.yt landing pages and overlays, adhering to the Maiks.yt theme token contract.

## 1. Satisfactory (Industrial Optimization)

**Mood and Audience:**
Focussed, efficient, industrial, and clean. The audience consists of players who love automation, math, and large-scale engineering.

**Color Tokens:**
```css
--maiks-bg: #1B2129; /* Deep charcoal industrial blue */
--maiks-fg: #F2F2F2; /* Off-white for readability */
--maiks-muted: #5E6975; /* Slate grey for secondary info */
--maiks-panel: #242D38; /* Slightly lighter industrial shade */
--maiks-accent: #E58E26; /* FICSIT Orange */
--maiks-danger: #D35400; /* Deep warning orange */
--maiks-warning: #F1C40F; /* Warning yellow */
--maiks-success: #27AE60; /* Power grid green */
--maiks-notification-bg: #E58E26;
--maiks-notification-fg: #1B2129;
```

**Typography Feel:**
Monospaced for data and labels (e.g., JetBrains Mono, Roboto Mono). Clean, high-readability sans-serif for main content (e.g., Inter, Montserrat).

**Landing Page Layout Ideas:**
- Grid-based layout mimicking a HUD or blueprint.
- "Project Assembly" progress bars for stream goals.
- Schematic-style line art for backgrounds.
- High-contrast panels for "Production Stats" (recent events).

**Overlay Notification Style:**
- Slide-in alerts with a "Terminal Boot" feel.
- Sound effects: Mechanical whirring or UI "blip" sounds.
- Visuals: Rotating gear or factory-line icons.

**Accessibility and Contrast Notes:**
- Orange accent should be used sparingly for CTA buttons to maintain high contrast against dark backgrounds.
- Ensure all muted text meets WCAG AA standards.

**Do/Don't List:**
- **Do:** Use sharp corners and borders to feel "engineered."
- **Do:** Include "efficiency ratings" or stats.
- **Don't:** Use soft gradients or rounded corners.
- **Don't:** Overuse bright colors that distract from the "work" vibe.

---

## 2. Minecraft (Exploration & Creativity)

**Mood and Audience:**
Whimsical, adventurous, cozy, and vibrant. Audience includes builders, redstone engineers, and casual explorers.

**Color Tokens:**
```css
--maiks-bg: #2C1B0E; /* Deep dirt/wood brown */
--maiks-fg: #F0EAD6; /* Eggshell/parchment */
--maiks-muted: #8B8B8B; /* Cobblestone grey */
--maiks-panel: #3D2B1F; /* Lighter wood grain shade */
--maiks-accent: #55FF55; /* Bright grass green */
--maiks-danger: #FF5555; /* Redstone/Heart red */
--maiks-warning: #FFAA00; /* Gold/Torch orange */
--maiks-success: #55FFFF; /* Diamond blue */
--maiks-notification-bg: #3D2B1F;
--maiks-notification-fg: #55FF55;
```

**Typography Feel:**
Blocky, pixel-inspired fonts for headings (e.g., Minecraftia, Press Start 2P). Warm, rounded sans-serif for body text (e.g., Nunito, Quicksand).

**Landing Page Layout Ideas:**
- "Inventory Slot" style containers for links and cards.
- Textured backgrounds (subtle dirt, grass, or stone patterns).
- Health and Hunger bar indicators for community milestones.

**Overlay Notification Style:**
- "Item Pickup" popups in the corner.
- Sound effects: Experience orb "ding" or chest opening.
- Visuals: Pixelated item icons (swords, hearts, blocks).

**Accessibility and Contrast Notes:**
- Use dark overlays behind light text on textured backgrounds.
- Green accent must be vibrant but checked against the brown background for legibility.

**Do/Don't List:**
- **Do:** Use blocky borders (3px-4px).
- **Do:** Lean into "cozy" vibes for building streams.
- **Don't:** Make it too bright/neon; keep it grounded in "blocks."
- **Don't:** Use thin, elegant serifs.

---

## 3. Coding / Build Streams (Developer Focus)

**Mood and Audience:**
High-tech, dark mode, focused, and systematic. Audience consists of developers, tech enthusiasts, and learners.

**Color Tokens:**
```css
--maiks-bg: #0D1117; /* GitHub Dark Dimmed background */
--maiks-fg: #C9D1D9; /* Light grey text */
--maiks-muted: #484F58; /* Muted borders/comments */
--maiks-panel: #161B22; /* Secondary dark layer */
--maiks-accent: #58A6FF; /* Logic blue */
--maiks-danger: #F85149; /* Error red */
--maiks-warning: #D29922; /* Warning yellow */
--maiks-success: #3FB950; /* Pass green */
--maiks-notification-bg: #161B22;
--maiks-notification-fg: #58A6FF;
```

**Typography Feel:**
Strictly Monospaced for everything or a very high-quality tech sans-serif (e.g., Fira Code, Source Code Pro, Inter).

**Landing Page Layout Ideas:**
- Sidebar navigation mimicking a file explorer (VS Code style).
- "Console" output area for recent subscribers or donations.
- "Dependencies" list for stream tools or stack info.

**Overlay Notification Style:**
- "Git Commit" style notifications.
- Visuals: Syntax-highlighted code blocks or terminal cursors.
- Sound effects: Subtle keyboard click or "success" chime.

**Accessibility and Contrast Notes:**
- Adhere strictly to dark-mode readability standards.
- Ensure "error red" and "warning yellow" are distinct for colorblind users.

**Do/Don't List:**
- **Do:** Use code-style syntax highlighting for accents.
- **Do:** Include "Current Task" or "Tech Stack" widgets.
- **Don't:** Use overly decorative elements.
- **Don't:** Use bright, flashing animations.

---

## 4. General Community (Maiks.yt Brand)

**Mood and Audience:**
Welcoming, bold, energetic, and professional. The broad audience for the main landing page and general hobby chat.

**Color Tokens:**
```css
--maiks-bg: #000000; /* Pure black */
--maiks-fg: #FFFFFF; /* Pure white */
--maiks-muted: #888888; /* Mid-grey */
--maiks-panel: #111111; /* Dark grey panels */
--maiks-accent: #4F9CFF; /* Signature Maiks Blue */
--maiks-danger: #FF4F4F; /* Vibrant red */
--maiks-warning: #FFD166; /* Warm yellow */
--maiks-success: #45D483; /* Emerald green */
--maiks-notification-bg: #111111;
--maiks-notification-fg: #FFFFFF;
```

**Typography Feel:**
Bold, modern, and high-impact. Grotesk or Neo-Grotesk fonts (e.g., Space Grotesk, Archivo, Uncut Sans).

**Landing Page Layout Ideas:**
- Hero section with bold typography and a clear CTA.
- "Living Room Dashboard" style: large touch targets and thick borders.
- Masonry grid for featured projects and community highlights.

**Overlay Notification Style:**
- Clean, minimalist cards with bold accents.
- Smooth transitions and elegant motion.
- Sound effects: Modern, high-fidelity UI sounds.

**Accessibility and Contrast Notes:**
- High contrast is the priority.
- Large font sizes for readability on mobile/PWA.

**Do/Don't List:**
- **Do:** Use thick borders (4px-6px).
- **Do:** Keep the layout breathable and spacious.
- **Don't:** Use generic "gamer" aesthetics (neon gradients).
- **Don't:** Overcomplicate the UI with too many widgets.
