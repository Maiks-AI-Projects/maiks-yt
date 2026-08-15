import styles from "./testing-guide.module.css";
import { TestingGuideQuickOpenClient } from "./testing-guide-quick-open-client";
import { TestingNoteCopyClient } from "./testing-note-copy-client";
import { TestingPassChecklistClient } from "./testing-pass-checklist-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Testing Guide | Maiks.yt",
  description: "Owner testing checklist for the Maiks.yt dev build."
};

type TestingPass = {
  title: string;
  goal: string;
  checks: readonly string[];
};

const readinessCommands = [
  {
    command: "pnpm test:readiness",
    description: "Local pre-testing gate: review checks, a bounded dev API startup wait, and the current 79-check dev smoke dry-run."
  },
  {
    command: "pnpm test:readiness -- --visual",
    description: "Adds screenshot coverage for public pages, admin surfaces, chat, moderation, and overlay after the readiness gate."
  },
  {
    command: "pnpm test:readiness -- --skip-review",
    description: "Container/server-friendly gate with the same dev API startup wait when the full local review shell is not needed."
  }
] as const;

const readinessEvidence = [
  {
    label: "Recurring smoke",
    value: "79 passing checks",
    note: "Guarded by the current dev smoke dry-run."
  },
  {
    label: "Latest visual smoke",
    value: "76 surfaces",
    note: "2026-07-10T07:39Z: 0 failures, 0 missing text, 0 auth stops, 0 injection markers, 0 rejected navbars, 0 horizontal overflow."
  },
  {
    label: "Artifact path",
    value: "reports/visual-qa/current-dev-smoke/2026-07-10T07-39-43Z/",
    note: "Ignored local screenshots and summary for the latest recorded baseline."
  }
] as const;

const installedWindowChecks = [
  "Install or open Streamer Chat, Moderation, Control Panel, and Notifications as separate app windows where the browser supports it.",
  "Confirm each installed window opens without the normal website navbar and keeps the expected route after restart.",
  "Confirm the chat and moderation windows stay signed in or show the Access Required recovery path clearly.",
  "Resize chat and moderation to 1366x768, 1600x900, and 1920x1080 if practical, and check for horizontal overflow or clipped action buttons.",
  "Confirm provider chat remains private to chat/moderation windows and does not appear on the OBS overlay by default."
] as const;

const testingPasses: readonly TestingPass[] = [
  {
    title: "Access And Recovery",
    goal: "Confirm Michael can get in, recover from mistakes, and inspect sensitive state.",
    checks: [
      "Open /admin and confirm dashboard cards render normally.",
      "Review /admin/sessions and verify revoke-others keeps the active browser alive.",
      "Review /admin/tokens and confirm overlay/control/chat URLs can be created or rotated.",
      "Check backup health and download a short-lived private key-data export.",
      "Open /tools/notifications from the installed phone PWA and verify read/archive behavior."
    ]
  },
  {
    title: "Stream Windows",
    goal: "Verify the standalone windows needed while live.",
    checks: [
      "If /chat, /moderation, or /control shows Access Required, open it from /admin or /admin/testing with your devAuthToken present, or create/rotate a Control Panel token from /admin/tokens and copy the Launch URL.",
      "Open the standalone /chat PWA and confirm newest messages are on top.",
      "Confirm Twitch, YouTube, and Discord status dots are compact and understandable.",
      "Open /moderation as a separate window and confirm the first panel is chat.",
      "Use fake/local chat first for hide, ban, warn, retract, Emergency clear, and Restore overlay drills.",
      "Confirm hidden or banned local messages stay off overlay chat."
    ]
  },
  {
    title: "Provider Intake",
    goal: "Confirm real provider intake is visible privately before any overlay routing.",
    checks: [
      "Send one harmless Twitch message from a test account and confirm it appears in /chat only.",
      "Send one harmless Discord message in the configured guild/channel and confirm it appears in /chat only.",
      "For YouTube, test real message capture only when an active live chat exists.",
      "Reconnect YouTube owner consent before live YouTube Warn tests if the stored credential is still read-only.",
      "Open /admin/connections and confirm recent intake rows are redacted.",
      "Confirm Provider Action Readiness lists warning sends as fail-closed and delete/timeout/ban as gated.",
      "Confirm provider health cards never expose raw tokens or payload secrets."
    ]
  },
  {
    title: "Content And Public Pages",
    goal: "Verify editable public content without accidental publishing.",
    checks: [
      "Create a harmless /admin/pages draft, preview it, publish it, then unpublish or delete it.",
      "Review /admin/links ordering and published state.",
      "Review /admin/projects preview, updates, item estimates, and item links.",
      "Review /admin/schedule stream focus and game links on public /schedule.",
      "Submit and review a harmless game suggestion, then confirm it moves from pending to Reviewed Suggestions.",
      "Open public links, projects, schedule, games, updates, community rules, privacy, and accountability pages."
    ]
  },
  {
    title: "Money And Accounting",
    goal: "Test private accounting mechanics without public payment behavior.",
    checks: [
      "Add a dated provider fee or platform split rule and confirm it appears in Dated Rules and Rule Impact Preview.",
      "Create draft entries from Rule Impact Preview and confirm a repeat run skips existing suggestions.",
      "Use the Status filter to show only drafts while reviewing imported or rule-impact entries.",
      "Post one reviewed rule-impact draft and confirm mistakes can still be voided.",
      "Create one private test income entry and one private test spending/cost entry.",
      "Attach receipt/reference metadata where useful.",
      "Paste the example CSV in Import Preview, confirm row warnings/totals, then create draft entries only after review.",
      "Use the Import Preview row filter to inspect ready, warning, and skipped rows.",
      "Post one reviewed imported draft and leave uncertain rows as drafts.",
      "Preview the same CSV/reference again and confirm duplicate_reference blocks repeated draft import.",
      "Preview a reference-less exact match and confirm possible_duplicate warns without blocking.",
      "Use a correction instead of editing historical meaning.",
      "Void one deliberate mistake and confirm it stays auditable.",
      "Export CSV, warning CSV, JSON summary, and the bundled review package."
    ]
  },
  {
    title: "Moderator And Helper Flow",
    goal: "Confirm moderator permissions are understandable and reversible.",
    checks: [
      "Review rank paths, rights, role grants, trust levels, expiration, and revocation fields.",
      "Create or update only harmless test grants.",
      "Confirm /moderation exposes actions based on rights.",
      "Revoke the test grant and confirm audit history remains visible.",
      "Open /admin/live-helper and confirm summaries omit raw payloads and tokens."
    ]
  },
  {
    title: "Event Routing And Overlay",
    goal: "Verify public stream output still requires explicit routing or approval.",
    checks: [
      "Confirm privacy, security, and provider-token events cannot route publicly.",
      "Use /dev/test-console for safe simulated events.",
      "Test an approval-required event and approve or reject it from event routing.",
      "Confirm safe simulated top/center overlay notifications render.",
      "Confirm normal provider chat does not appear on overlay unless explicitly routed later."
    ]
  }
];

const testingNoteTemplate = `Testing note
Surface:
What I tried:
What happened:
Expected:
Severity: blocking / annoying / polish
Screenshot or recording:
Follow-up owner:`;

const TestingGuidePage = (): React.ReactNode => (
  <main className={`${styles.page} project-admin-page testing-guide-page`}>
    <section className={`${styles.surface} project-admin-shell`}>
      <header className={`${styles.header} project-admin-header`}>
        <div>
          <p className={styles.eyebrow}>Owner Testing</p>
          <h1>Owner Testing Dashboard</h1>
          <p className={styles.mutedText}>
            First-pass manual testing order for the current dev build. This surface is for owner-only operations and quick run-throughs.
          </p>
          <p className={styles.mutedText}>Current recurring smoke baseline: 79 passing checks.</p>
        </div>
        <a className={`${styles.backLink} admin-dashboard-link`} href="/admin">
          Back to admin
        </a>
      </header>

      <section className={`${styles.panel} project-admin-panel`}>
        <div className={`${styles.sectionHeading} project-admin-panel-heading`}>
          <div>
            <h2>Latest Readiness Evidence</h2>
            <p>Use this as the current confidence snapshot before manual testing starts.</p>
          </div>
        </div>
        <ol className={`${styles.tightRecordList} project-admin-record-list`}>
          {readinessEvidence.map((item) => (
            <li className={styles.record} key={item.label}>
              <div>
                <strong>{item.label}: {item.value}</strong>
                <p>{item.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className={`${styles.panel} project-admin-panel`}>
        <div className={`${styles.sectionHeading} project-admin-panel-heading`}>
          <div>
            <h2>Readiness Commands</h2>
            <p>Run these before or after a testing session depending on coverage needs.</p>
          </div>
        </div>
        <ol className={`${styles.tightRecordList} project-admin-record-list`}>
          {readinessCommands.map((item) => (
            <li className={styles.record} key={item.command}>
              <div>
                <strong><code>{item.command}</code></strong>
                <p>{item.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <TestingGuideQuickOpenClient />

      <section className={`${styles.panel} project-admin-panel`}>
        <details className={styles.disclosure} open>
          <summary className={styles.disclosureSummary}>
            <div>
              <h2>Installed Window Checklist</h2>
              <p>Use this pass for PWA/browser-window behavior that headless smoke cannot fully prove.</p>
            </div>
            <span>{installedWindowChecks.length} checks</span>
          </summary>

          <ol className={`${styles.tightRecordList} project-admin-record-list`}>
            {installedWindowChecks.map((check) => (
              <li className={styles.record} key={check}>
                <p>{check}</p>
              </li>
            ))}
          </ol>
        </details>
      </section>

      <TestingPassChecklistClient passes={testingPasses} />

      <section className={`${styles.panel} project-admin-panel project-admin-note`}>
        <div className={`${styles.sectionHeading} project-admin-panel-heading`}>
          <div>
            <h2>Record Breakage</h2>
            <p className={styles.mutedText}>
              For each problem, record the page or window, whether it blocks streaming, and attach screenshots for visual/layout issues.
            </p>
          </div>
          <TestingNoteCopyClient template={testingNoteTemplate} />
        </div>
        <pre className={styles.noteTemplate}><code>{testingNoteTemplate}</code></pre>
      </section>
    </section>
  </main>
);

export default TestingGuidePage;
