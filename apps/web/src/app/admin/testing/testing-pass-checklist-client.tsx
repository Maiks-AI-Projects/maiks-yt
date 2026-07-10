"use client";

import { useEffect, useMemo, useState } from "react";

type TestingPassChecklistClientProps = {
  passes: readonly {
    title: string;
    goal: string;
    checks: readonly string[];
  }[];
};

const storageKey = "maiks-yt-testing-guide-checked-v1";

const getCheckId = (passTitle: string, check: string): string => `${passTitle}::${check}`;

const readChecked = (): Set<string> => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]") as unknown;

    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
  } catch {
    return new Set();
  }
};

export const TestingPassChecklistClient = ({ passes }: TestingPassChecklistClientProps): React.ReactNode => {
  const [checked, setChecked] = useState<Set<string>>(() => new Set());
  const [loaded, setLoaded] = useState(false);
  const totalChecks = useMemo(
    () => passes.reduce((total, testingPass) => total + testingPass.checks.length, 0),
    [passes]
  );

  useEffect(() => {
    setChecked(readChecked());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(storageKey, JSON.stringify([...checked].sort()));
    }
  }, [checked, loaded]);

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

  return (
    <section className="project-admin-panel testing-checklist-panel">
      <div className="project-admin-panel-heading">
        <div>
          <h2>Manual Testing Checklist</h2>
          <p>{checked.size}/{totalChecks} checks marked in this browser.</p>
        </div>
        <button type="button" className="secondary-action" onClick={reset} disabled={checked.size === 0}>
          Reset marks
        </button>
      </div>

      <div className="project-admin-grid">
        {passes.map((testingPass) => (
          <section className="project-admin-preview testing-checklist-pass" key={testingPass.title}>
            <h2>{testingPass.title}</h2>
            <p>{testingPass.goal}</p>
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
