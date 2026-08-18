// YouTube Studio does not provide a supported Audio Library catalog export API.
// Keep UI selectors isolated here so a Studio redesign can be repaired without
// changing the importer contract or database/API behavior.
export const studioAudioLibrarySelectors = {
  filterButtons: [
    "button[aria-label*='Filter' i]",
    "ytcp-button[aria-label*='Filter' i]",
    "[role='button'][aria-label*='Filter' i]"
  ],
  attributionFilterOptions: [
    "text=/Attribution required/i",
    "[role='option']:has-text('Attribution required')",
    "[role='menuitem']:has-text('Attribution required')"
  ],
  trackRows: [
    "ytal-track-row",
    "ytcp-audio-library-track-row",
    "ytcp-video-row",
    "[role='row']",
    "tr"
  ],
  title: [
    "[id*='title' i]",
    "[class*='title' i]",
    "[aria-label*='title' i]",
    "a[href*='audiolibrary']"
  ],
  artist: [
    "[id*='artist' i]",
    "[class*='artist' i]",
    "[aria-label*='artist' i]",
    "[id*='author' i]",
    "[class*='author' i]"
  ],
  license: [
    "[id*='license' i]",
    "[class*='license' i]",
    "[aria-label*='license' i]"
  ],
  attribution: [
    "textarea[aria-label*='Attribution' i]",
    "input[aria-label*='Attribution' i]",
    "[id*='attribution' i]",
    "[class*='attribution' i]",
    "[aria-label*='Attribution' i]"
  ],
  dialogs: [
    "[role='dialog']",
    "ytcp-dialog",
    "tp-yt-paper-dialog"
  ],
  proofLinks: [
    "a[href*='studio.youtube.com']",
    "a[href*='youtube.com/audiolibrary']",
    "a[href*='creativecommons.org/licenses/by/4.0']",
    "a[href]"
  ],
  closeButtons: [
    "button[aria-label*='Close' i]",
    "ytcp-icon-button[aria-label*='Close' i]",
    "[role='button'][aria-label*='Close' i]"
  ],
  detailButtons: [
    "button[aria-label*='details' i]",
    "button[aria-label*='license' i]",
    "[role='button'][aria-label*='details' i]",
    "[role='button'][aria-label*='license' i]"
  ],
  downloadButtons: [
    "a[download]",
    "a[href*='download']",
    "button[aria-label*='Download' i]",
    "[role='button'][aria-label*='Download' i]"
  ],
  scrollContainers: [
    "ytcp-app",
    "main",
    "[role='main']",
    "body"
  ]
};
