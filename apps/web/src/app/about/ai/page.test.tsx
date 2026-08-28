import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import AiPage, { metadata } from "./page";

const approvedPublicCopy = [
  "AI and my work",
  "I use AI. I stay responsible.",
  "Maiks.yt, including the website and stream overlays, was built with AI assistance under my direction. I use it much like notes, checklists, search, and code tools: to keep more work reachable.",
  "What AI helps with",
  "A tool under my direction",
  "My memory, focus, energy, and planning are not always steady. AI helps me break work down, compare options, draft and rewrite text, remember what changed, and organize streams. I decide what to use, what to change, and what belongs on Maiks.yt.",
  "What stays mine",
  "The stream is still me",
  "The gameplay, voice, reactions, decisions, live camera, and live footage are real and mine. AI can help me prepare and organize, but it does not make those choices for me. I am responsible for what I publish and what happens on my stream.",
  "Current limits",
  "No live AI host",
  "Today, AI is not speaking on stream, posting as me, moderating viewers, or controlling what viewers see. The current homepage workspace image was generated and is temporary. Other visual and audio assets have not all been inventoried yet.",
  "Some people do not want to use AI or watch AI-assisted work. I respect that choice. I ask for the same respect for mine.",
  "Read the medical context ->"
].join(" ");

const normalizePublicCopy = (markup: string): string => markup
  .replace(/^.*?<\/nav>/s, "")
  .replace(/<\/main>.*$/s, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&gt;/g, ">")
  .replace(/&amp;/g, "&")
  .replace(/\s+/g, " ")
  .trim();

describe("/about/ai", () => {
  it("publishes the approved metadata", () => {
    expect(metadata).toEqual({
      title: "AI and my work",
      description: "How Michael uses AI assistance on Maiks.yt while keeping the public work under his own direction and responsibility."
    });
  });

  it("renders the approved copy and factual boundaries", () => {
    const markup = renderToStaticMarkup(<AiPage />);

    expect(normalizePublicCopy(markup)).toBe(approvedPublicCopy);
    expect(markup).toMatch(
      /<a[^>]*href="\/about\/health"[^>]*>Read the medical context -&gt;<\/a>/
    );
    expect(markup.match(/aria-current="page"/g)).toHaveLength(1);
    expect(markup).toMatch(/aria-current="page" href="\/about\/ai"/);
  });
});
