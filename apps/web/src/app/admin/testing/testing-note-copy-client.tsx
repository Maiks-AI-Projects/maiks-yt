"use client";

import { useState } from "react";

type TestingNoteCopyClientProps = {
  template: string;
};

export const TestingNoteCopyClient = ({ template }: TestingNoteCopyClientProps): React.ReactNode => {
  const [message, setMessage] = useState("Ready to copy.");

  const copyTemplate = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(template);
      setMessage("Copied testing note template.");
    } catch {
      setMessage("Copy failed. Select the template text manually.");
    }
  };

  return (
    <div className="admin-inline-actions testing-note-copy-actions">
      <button type="button" onClick={() => void copyTemplate()}>
        Copy template
      </button>
      <span>{message}</span>
    </div>
  );
};
