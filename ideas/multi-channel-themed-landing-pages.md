# Multi-channel Themed Landing Pages

## Idea

Create separate landing pages for different channels, games, hobbies, or creator personas. Each landing page points into the same wider website, but sets a default visual theme based on where the visitor entered.

Examples:

- a Minecraft-focused landing page
- a tech or AI hobby landing page
- a general Maiks landing page
- future pages for new games, projects, or side channels

V1 planned a larger hobby-channel network including Minecraft, Hytale, Satisfactory, Talking, World of Warcraft, Micro Electronics, 3D Printing, Programming, Brain Damaged, Tech, AI, Outdoors, and Odd Jobs.

Logged-in users can choose a preferred theme that overrides the landing-page default.

## Why It Matters

This lets each audience feel like they arrived somewhere made for them, while still keeping the content, user accounts, donations, profiles, and overlay systems connected.

It also supports future channel expansion without rebuilding the entire site for every new niche.

## Data Needed

- channels or creator personas
- channel/hobby type
- subdomain or route mapping
- landing page slugs
- theme definitions
- user theme preference
- default theme per landing page
- channel links for Twitch, YouTube, Discord, and other platforms

## Build Requirements

- routing for multiple public landing pages
- optional host/subdomain-based routing
- shared site navigation
- theme system with strong typing
- user setting for preferred theme
- fallback/default theme when no preference exists
- admin tools to add or change landing pages later

## Type-safety Notes

Themes should probably be defined as typed config objects rather than loose strings. Each theme could include colors, fonts, assets, overlay styling, and optional landing-page content.

## Open Questions

- Should every landing page have custom content, or mostly the same content with a different theme?
- Which V1 channels should be revived first?
- Should themes affect only visuals, or also featured projects, links, and overlay behavior?
- Can guests switch themes, and should that preference be remembered in local storage?
