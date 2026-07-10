"use client";

import { useEffect, useMemo, useState } from "react";

type TestingPassChecklistClientProps = {
  passes: readonly {
    title: string;
    goal: string;
    checks: readonly string[];
  }[];
};

const checkedStorageKey = "maiks-yt-testing-guide-checked-v1";
const notesStorageKey = "maiks-yt-testing-guide-notes-v1";

const getCheckId = (passTitle: string, check: string): string => `${passTitle}::${check}`;

const readChecked = (): Set<string> => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(checkedStorageKey) ?? "[]") as unknown;

    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
};

const readNotes = (): string => window.localStorage.getItem(notesStorageKey) ?? "";

const buildProgressSummary = (
  passes: TestingPassChecklistClientProps["passes"],
  checked: Set<string>,
  notes: string
): string => {
  const totalChecks = passes.reduce((total, testingPass) => total + testingPass.checks.length, 0);
  const lines = [
    "Maiks.yt dev testing progress",
    `Generated: ${new Date().toISOString()}`,
    `Checked: ${checked.size}/${totalChecks}`,
    ""
  ];

  for (const testingPass of passes) {
    const checkedInPass = testingPass.checks.filter((check) => checked.has(getCheckId(testingPass.title, check))).length;
    lines.push(`${testingPass.title}: ${checkedInPass}/${testingPass.checks.length}`);

    for (const check of testingPass.checks) {
      lines.push(`${checked.has(getCheckId(testingPass.title, check)) ? "[x]" : "[ ]"} ${check}`);
    }

    lines.push("");
  }

  if (notes.trim()) {
    lines.push("Session notes:", notes.trim(), "");
  }

  return lines.join("\n").trimEnd();
};

export const TestingPassChecklistClient = ({ passes }: TestingPassChecklistClientProps): React.ReactNode => {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("Progress is saved in this browser.");
  const [notes, setNotes] = useState("");
  const totalChecks = useMemo(
    () => passes.reduce((total, testingPass) => total + testingPass.checks.length, 0),
    [passes]
  );

  useEffect(() => {
    setChecked(readChecked());
    setNotes(readNotes());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(checkedStorageKey, JSON.stringify([...checked].sort()));
    }
  }, [checked, loaded]);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(notesStorageKey, notes);
    }
  }, [loaded, notes]);

  const toggleCheck = (id: string): void => {
    setChecked((current) => {
      const next = new Set(current);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  };

  const reset = (): void => setChecked(new Set());

  const clearNotes = (): void => setNotes("");

  const markPass = (testingPass: TestingPassChecklistClientProps["passes"][number]): void => {
    setChecked((current) => {
      const next = new Set(current);

      for (const check of testingPass.checks) {
        next.add(getCheckId(testingPass.title, check));
      }

      return next;
    });
  };

  const clearPass = (testingPass: TestingPassChecklistClientProps["passes"][number]): void => {
    setChecked((current) => {
      const next = new Set(current);

      for (const check of testingPass.checks) {
        next.delete(getCheckId(testingPass.title, check));
      }

      return next;
    });
  };

  const copyProgress = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(buildProgressSummary(passes, checked, notes));
      setMessage("Copied testing progress.");
    } catch {
      setMessage("Copy failed. Browser clipboard access is blocked.");
    }
  };

  return (
    <section className="project-admin-panel testing-checklist-panel">
      <div className="project-admin-panel-heading">
        <div>
          <h2>Manual Testing Checklist</h2>
          <p>{checked.size}/{totalChecks} checks marked in this browser.</p>
        </div>
        <div className="admin-inline-actions testing-checklist-actions">
          <button type="button" onClick={() => void copyProgress()}>
            Copy progress
          </button>
          <button type="button" className="secondary-action" onClick={reset} disabled={checked.size === 0}>
            Reset marks
          </button>
          <span>{message}</span>
        </div>
      </div>

      <label className="testing-session-notes">
        <span>Session Notes</span>
        <textarea
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Jot blockers, odd behavior, links, screenshots, or follow-up names while testing."
          value={notes}
        />
      </label>
      <div className="admin-inline-actions testing-checklist-actions">
        <button type="button" className="secondary-action" onClick={clearNotes} disabled={!notes.trim()}>
          Clear notes
        </button>
      </div>

      <div className="project-admin-grid">
        {passes.map((testingPass) => (
          <section className="project-admin-preview testing-checklist-pass" key={testingPass.title}>
            <div className="testing-checklist-pass-heading">
              <div>
                <h2>{testingPass.title}</h2>
                <p>{testingPass.goal}</p>
              </div>
              <div className="admin-inline-actions testing-checklist-pass-actions">
                <button type="button" className="secondary-action" onClick={() => markPass(testingPass)}>
                  Mark section done
                </button>
                <button type="button" className="secondary-action" onClick={() => clearPass(testingPass)}>
                  Clear section
                </button>
              </div>
            </div>
            <div className="testing-checklist-items">
              {testingPass.checks.map((check) => {
                const id = getCheckId(testingPass.title, check);

                return (
                  <label className="testing-checklist-item" key={id}>
                    <input
                      checked={checked.has(id)}
                      onChange={() => toggleCheck(id)}
                      type="checkbox"
                    />
                    <span>{check}</span>
                  </label>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
};
