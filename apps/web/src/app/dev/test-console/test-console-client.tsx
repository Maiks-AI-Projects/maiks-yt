"use client";

import { useMemo, useState } from "react";
import {
  canSourceEmitEventKind,
  eventSourcePlatforms,
  getEventRegistryEntry,
  listEventKindsForSource,
  type EventKind,
  type EventRegistryEntry,
  type EventRoutingSafety,
  type EventSourcePlatform
} from "@maiks-yt/domain/events";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

type PreviewPayload = {
  id: string;
  generatedAt: string;
  sourcePlatform: EventSourcePlatform;
  kind: EventKind;
  headline: string;
  actor: string;
  platformLabel: string;
  action: string;
  displayText: string;
  overlayEligible: boolean;
  simulatedOnly: boolean;
  internalOnly: boolean;
  testOnly: boolean;
};

type DispatchResponse =
  | {
    ok: true;
    status: string;
    destination: string | null;
    history: {
      id: string;
      routingOutcome: string;
      destination: string | null;
      isTest: true;
      isSimulated: true;
      isRealMoney: false;
      testResettable: true;
    };
    approvalQueue: {
      id: string;
      status: "pending";
      destination: string;
    } | null;
    cooldownsRecorded: number;
    publicPlayback: false;
  }
  | {
    ok: false;
    reason: string;
    issues?: readonly string[];
    ruleIssues?: readonly string[];
  };

const sourceLabels: Record<EventSourcePlatform, string> = {
  twitch: "Twitch",
  youtube: "YouTube",
  discord: "Discord",
  website: "Website",
  "test/system": "Test/System"
};

const actorNames = [
  "PixelMaik",
  "LunaForge",
  "NovaMango",
  "CodeCoyote",
  "MintCircuit",
  "AriaByte",
  "JasperQuest",
  "VeraFlux"
] as const;

const projects = [
  "Maiks.yt V2",
  "Stream Tools PWA",
  "Creator Hub",
  "Overlay Polish",
  "Project Journal"
] as const;

const chatLines = [
  "This layout is clean.",
  "Can you show the project board?",
  "The overlay timing feels good.",
  "Nice progress on the dev site."
] as const;

const moneyAmounts = ["EUR 2.00", "EUR 5.00", "EUR 10.00", "EUR 25.00"] as const;

const selectRandom = <Value,>(values: readonly Value[]): Value =>
  values[Math.floor(Math.random() * values.length)] as Value;

const makePreviewId = (): string =>
  `preview_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const formatSafetyLabel = (key: keyof EventRoutingSafety): string => {
  const labels: Record<keyof EventRoutingSafety, string> = {
    overlayEligible: "Overlay eligible",
    internalOnly: "Internal only",
    moneyGated: "Money gate",
    providerGated: "Provider gate",
    approvalRecommended: "Approval recommended",
    optOutSupported: "Opt-out ready",
    cooldownRecommended: "Cooldown recommended",
    simulatedOnly: "Simulated only"
  };

  return labels[key];
};

const getActiveSafetyBadges = (safety: EventRoutingSafety): string[] =>
  (Object.entries(safety) as Array<[keyof EventRoutingSafety, boolean]>)
    .filter(([, enabled]) => enabled)
    .map(([key]) => formatSafetyLabel(key));

const buildActionText = (
  entry: EventRegistryEntry,
  actor: string,
  sourcePlatform: EventSourcePlatform
): { action: string; displayText: string } => {
  const project = selectRandom(projects);

  switch (entry.kind) {
    case "chat":
      return {
        action: "sent a chat message",
        displayText: `${actor}: ${selectRandom(chatLines)}`
      };
    case "website.signup":
      return {
        action: "created a website account",
        displayText: `${actor} joined Maiks.yt.`
      };
    case "website.username-change":
      return {
        action: "updated a public username",
        displayText: `${actor} changed their public display name.`
      };
    case "website.profile-image-update":
      return {
        action: "updated a profile image",
        displayText: `${actor} refreshed their public profile image.`
      };
    case "website.project-update-published":
      return {
        action: "published a project update",
        displayText: `${project} has a new public update from Maiks.yt.`
      };
    case "website.schedule-changed":
      return {
        action: "changed the public stream schedule",
        displayText: `${project} stream schedule was updated.`
      };
    case "website.schedule-cancelled":
      return {
        action: "cancelled a public stream",
        displayText: `${project} stream was cancelled with public wording.`
      };
    case "website.action-panel-item":
      return {
        action: "created an internal action item",
        displayText: `Internal action item for ${project} is ready for owner review.`
      };
    case "website.free-tts-request":
      return {
        action: "requested a free website TTS message",
        displayText: `${actor} submitted a free website TTS test message.`
      };
    case "website.account-security-change":
      return {
        action: "changed account security settings",
        displayText: `${actor} changed account security settings. Keep internal.`
      };
    case "website.provider-token-change":
      return {
        action: "updated provider token state",
        displayText: `${sourceLabels[sourcePlatform]} provider token state changed. Keep internal.`
      };
    case "twitch.follow":
      return {
        action: "followed on Twitch",
        displayText: `${actor} followed the Twitch channel.`
      };
    case "twitch.sub":
      return {
        action: "subscribed on Twitch",
        displayText: `${actor} subscribed on Twitch for 3 months.`
      };
    case "twitch.bits":
      return {
        action: "sent Twitch bits",
        displayText: `${actor} cheered 500 bits. Simulated preview only.`
      };
    case "twitch.raid":
      return {
        action: "started a Twitch raid",
        displayText: `${actor} raided with 18 viewers.`
      };
    case "twitch.redeem":
      return {
        action: "redeemed channel points",
        displayText: `${actor} redeemed Highlight My Message.`
      };
    case "youtube.subscriber":
      return {
        action: "subscribed on YouTube",
        displayText: `${actor} subscribed to the YouTube channel.`
      };
    case "youtube.member":
      return {
        action: "became a YouTube member",
        displayText: `${actor} became a YouTube channel member.`
      };
    case "youtube.super-chat":
      return {
        action: "sent a YouTube Super Chat",
        displayText: `${actor} sent a ${selectRandom(moneyAmounts)} Super Chat. Simulated preview only.`
      };
    case "youtube.super-sticker":
      return {
        action: "sent a YouTube Super Sticker",
        displayText: `${actor} sent a ${selectRandom(moneyAmounts)} Super Sticker. Simulated preview only.`
      };
    case "discord.message":
      return {
        action: "posted in Discord",
        displayText: `${actor} posted in the community Discord.`
      };
    case "discord.join":
      return {
        action: "joined Discord",
        displayText: `${actor} joined the Discord community.`
      };
    case "discord.role":
      return {
        action: "changed a Discord role",
        displayText: `${actor} received a Discord role update. Keep internal.`
      };
    case "discord.boost":
      return {
        action: "boosted Discord",
        displayText: `${actor} boosted the Discord server.`
      };
    case "simulated.support-money":
      return {
        action: "created simulated support money",
        displayText: `${actor} sent ${selectRandom(moneyAmounts)} simulated support. Test only, no real payment.`
      };
  }
};

const buildPreview = (sourcePlatform: EventSourcePlatform, kind: EventKind): PreviewPayload => {
  const entry = getEventRegistryEntry(kind);
  const actor = selectRandom(actorNames);
  const eventText = buildActionText(entry, actor, sourcePlatform);

  return {
    id: makePreviewId(),
    generatedAt: new Date().toISOString(),
    sourcePlatform,
    kind,
    headline: `${sourceLabels[sourcePlatform]} - ${entry.label}`,
    actor,
    platformLabel: sourceLabels[sourcePlatform],
    action: eventText.action,
    displayText: eventText.displayText,
    overlayEligible: entry.safety.overlayEligible && !entry.safety.internalOnly,
    simulatedOnly: entry.safety.simulatedOnly,
    internalOnly: entry.safety.internalOnly,
    testOnly: true
  };
};

const chooseRandomValidCombination = (): Pick<PreviewPayload, "sourcePlatform" | "kind"> => {
  const sourcePlatform = selectRandom(eventSourcePlatforms);
  const kinds = listEventKindsForSource(sourcePlatform);

  return {
    sourcePlatform,
    kind: selectRandom(kinds)
  };
};

const DevTestConsoleClient = (): React.ReactNode => {
  const [selectedSource, setSelectedSource] = useState<EventSourcePlatform>("website");
  const [selectedKind, setSelectedKind] = useState<EventKind>("website.signup");
  const [preview, setPreview] = useState<PreviewPayload>(() => buildPreview("website", "website.signup"));
  const [dispatchResult, setDispatchResult] = useState<DispatchResponse | null>(null);
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [dispatchPending, setDispatchPending] = useState(false);

  const sourceEventKinds = useMemo(() => listEventKindsForSource(selectedSource), [selectedSource]);
  const selectedEntry = useMemo(() => getEventRegistryEntry(selectedKind), [selectedKind]);
  const validSelection = canSourceEmitEventKind(selectedSource, selectedKind);
  const visibleEntries = useMemo(
    () => sourceEventKinds.map((kind) => getEventRegistryEntry(kind)),
    [sourceEventKinds]
  );

  const selectSource = (sourcePlatform: EventSourcePlatform): void => {
    const nextKinds = listEventKindsForSource(sourcePlatform);
    setSelectedSource(sourcePlatform);

    if (!nextKinds.includes(selectedKind)) {
      setSelectedKind(nextKinds[0] as EventKind);
    }
  };

  const generateSelectedPreview = (): void => {
    if (!validSelection) {
      return;
    }

    setPreview(buildPreview(selectedSource, selectedKind));
    setDispatchResult(null);
    setDispatchError(null);
  };

  const generateRandomPreview = (): void => {
    const randomSelection = chooseRandomValidCombination();
    setSelectedSource(randomSelection.sourcePlatform);
    setSelectedKind(randomSelection.kind);
    setPreview(buildPreview(randomSelection.sourcePlatform, randomSelection.kind));
    setDispatchResult(null);
    setDispatchError(null);
  };

  const dispatchCurrentPreview = async (): Promise<void> => {
    setDispatchPending(true);
    setDispatchError(null);

    try {
      const response = await fetch(`${apiBaseUrl}/dev/event-routing/dispatch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourcePlatform: preview.sourcePlatform,
          eventKind: preview.kind,
          explicitSimulation: true,
          isRealMoney: false,
          sourceEventId: preview.id,
          actorDisplayName: preview.actor,
          redactedPayload: preview,
          occurredAt: preview.generatedAt
        })
      });
      const body = await response.json() as DispatchResponse;
      setDispatchResult(body);

      if (!response.ok || !body.ok) {
        setDispatchError(body.ok ? "Dispatch rejected by API." : body.reason);
      }
    } catch (error) {
      setDispatchError(error instanceof Error ? error.message : "Dispatch request failed.");
      setDispatchResult(null);
    } finally {
      setDispatchPending(false);
    }
  };

  return (
    <>
      <header className="project-admin-header dev-test-console-header">
        <p className="eyebrow">Dev-only test console</p>
        <h1>Simulated Event Preview</h1>
        <p>
          Preview valid source and event combinations from the typed event registry, then send safe simulated
          test events through the dev-only router.
        </p>
      </header>

      <section className="project-admin-state dev-test-console-warning">
        <h2>Safe simulation only</h2>
        <p>
          Dispatches from this page are marked test/simulated/resettable and never real money. The API rejects
          real provider intake, real website production events, and public playback wiring.
        </p>
      </section>

      <section className="project-admin-panel dev-test-console-controls">
        <div className="project-admin-panel-heading">
          <div>
            <h2>Source Capability Selector</h2>
            <p>Event kinds are filtered to combinations the selected source can emit.</p>
          </div>
          <button type="button" onClick={generateRandomPreview}>
            Random valid preview
          </button>
        </div>

        <div className="project-admin-form-grid">
          <label>
            Source
            <select
              value={selectedSource}
              onChange={(event) => selectSource(event.target.value as EventSourcePlatform)}
            >
              {eventSourcePlatforms.map((sourcePlatform) => (
                <option key={sourcePlatform} value={sourcePlatform}>
                  {sourceLabels[sourcePlatform]}
                </option>
              ))}
            </select>
          </label>

          <label>
            Event kind
            <select
              value={selectedKind}
              onChange={(event) => setSelectedKind(event.target.value as EventKind)}
            >
              {visibleEntries.map((entry) => (
                <option key={entry.kind} value={entry.kind}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="dev-test-console-event-list" aria-label="Event kinds for selected source">
          {visibleEntries.map((entry) => (
            <button
              className={entry.kind === selectedKind ? "selected" : ""}
              key={entry.kind}
              onClick={() => setSelectedKind(entry.kind)}
              type="button"
            >
              <strong>{entry.label}</strong>
              <span>{entry.kind}</span>
            </button>
          ))}
        </div>

        <div className="dev-test-console-safety">
          <div>
            <h3>{selectedEntry.label}</h3>
            <p>{selectedEntry.description}</p>
          </div>
          <div className="dev-test-console-badges">
            {getActiveSafetyBadges(selectedEntry.safety).map((label) => (
              <span
                className={label === "Internal only" || label === "Simulated only" ? "warning" : ""}
                key={label}
              >
                {label}
              </span>
            ))}
            {!selectedEntry.safety.overlayEligible || selectedEntry.safety.internalOnly ? (
              <span className="blocked">Not overlay-eligible</span>
            ) : null}
            {selectedEntry.safety.moneyGated ? (
              <span className="warning">Test money only</span>
            ) : null}
          </div>
        </div>

        <button disabled={!validSelection} onClick={generateSelectedPreview} type="button">
          Generate selected preview
        </button>
      </section>

      <section className="project-admin-panel dev-test-console-preview">
        <div className="project-admin-panel-heading">
          <div>
            <h2>Mock Display Data</h2>
            <p>Generated locally from a valid source and event-kind combination.</p>
          </div>
          <span className="dev-test-console-preview-id">{preview.id}</span>
        </div>

        <div className="dev-test-console-preview-card">
          <div>
            <span>{preview.platformLabel}</span>
            <h3>{preview.headline}</h3>
            <p>{preview.displayText}</p>
          </div>
          <dl>
            <div>
              <dt>Actor</dt>
              <dd>{preview.actor}</dd>
            </div>
            <div>
              <dt>Action</dt>
              <dd>{preview.action}</dd>
            </div>
            <div>
              <dt>Overlay</dt>
              <dd>{preview.overlayEligible ? "Eligible after routing rules" : "Not overlay-eligible"}</dd>
            </div>
            <div>
              <dt>Generated</dt>
              <dd>{new Intl.DateTimeFormat(undefined, { timeStyle: "medium" }).format(new Date(preview.generatedAt))}</dd>
            </div>
          </dl>
        </div>

        <pre>{JSON.stringify(preview, null, 2)}</pre>
      </section>

      <section className="project-admin-panel dev-test-console-preview">
        <div className="project-admin-panel-heading">
          <div>
            <h2>Safe Dispatch Result</h2>
            <p>Persists safe test history and queued state only; no overlay or control playback is emitted.</p>
          </div>
          <button disabled={dispatchPending} onClick={dispatchCurrentPreview} type="button">
            {dispatchPending ? "Dispatching..." : "Dispatch safe simulation"}
          </button>
        </div>

        {dispatchError ? (
          <div className="project-admin-state dev-test-console-warning">
            <h3>Dispatch rejected</h3>
            <p>{dispatchError}</p>
          </div>
        ) : null}

        {dispatchResult?.ok ? (
          <div className="dev-test-console-preview-card">
            <div>
              <span>{dispatchResult.publicPlayback ? "Playback emitted" : "No public playback"}</span>
              <h3>{dispatchResult.status}</h3>
              <p>
                History {dispatchResult.history.id}
                {dispatchResult.approvalQueue ? ` queued for ${dispatchResult.approvalQueue.destination}` : ""}
              </p>
            </div>
            <dl>
              <div>
                <dt>Destination</dt>
                <dd>{dispatchResult.destination ?? "None"}</dd>
              </div>
              <div>
                <dt>Flags</dt>
                <dd>
                  {dispatchResult.history.isTest && dispatchResult.history.isSimulated
                    && !dispatchResult.history.isRealMoney && dispatchResult.history.testResettable
                    ? "test simulated resettable no-real-money"
                    : "unexpected flags"}
                </dd>
              </div>
              <div>
                <dt>Approval</dt>
                <dd>{dispatchResult.approvalQueue?.status ?? "Not queued"}</dd>
              </div>
              <div>
                <dt>Cooldowns</dt>
                <dd>{dispatchResult.cooldownsRecorded}</dd>
              </div>
            </dl>
          </div>
        ) : null}

        {dispatchResult ? (
          <pre>{JSON.stringify(dispatchResult, null, 2)}</pre>
        ) : null}
      </section>
    </>
  );
};

export default DevTestConsoleClient;
