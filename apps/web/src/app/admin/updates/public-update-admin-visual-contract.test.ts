import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const readLocalSource = (name: string): string => readFileSync(new URL(name, import.meta.url), "utf8");

describe("public update admin visual contract", () => {
  it("keeps the approved dense desktop geometry and compact responsive collapse", () => {
    const css = readLocalSource("./public-update-admin.module.css");

    expect(css).toContain("grid-template-columns: minmax(20rem, 23.75rem) minmax(0, 1fr);");
    expect(css).toContain("height: calc(100vh - 7.5rem);");
    expect(css).toContain("min-height: 3.65rem !important;");
    expect(css).toContain("grid-template-columns: 6.4rem minmax(0, 1fr);");
    expect(css).toContain("min-height: 18rem;");
    expect(css).toMatch(/\.fieldHint\s*\{[^}]*min-width: 0;[^}]*overflow-wrap: anywhere;/s);
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr);");
  });

  it("keeps the approved editor copy and omits inventory counts and helper footer", () => {
    const editor = readLocalSource("./public-update-admin-editor-form.tsx");
    const inventory = readLocalSource("./public-update-admin-inventory.tsx");
    const workspace = readLocalSource("./public-update-admin-workspace.tsx");

    expect(editor).toContain("Body (Markdown)");
    expect(editor).toContain("Used in the URL:");
    expect(editor).toContain("Show at the top of the updates list");
    expect(editor).toContain('id="public-update-editor-form"');
    expect(inventory).toContain('["all", "All"]');
    expect(inventory).not.toContain("Drafts stay hidden until previewed and published.");
    expect(workspace).toContain("Discard changes");
    expect(workspace).toContain('form="public-update-editor-form"');
    expect(workspace).toContain("FiInfo");
    expect(workspace).toContain("FiSave");
    expect(workspace).toContain("FiSend");
  });

  it("keeps the production save, preview, publication, and interaction contracts", () => {
    const client = readLocalSource("./public-update-admin-client.tsx");
    const inventory = readLocalSource("./public-update-admin-inventory.tsx");
    const rules = readLocalSource("./public-update-admin.rules.ts");
    const service = readLocalSource("./public-update-admin-workspace.service.ts");
    const workspace = readLocalSource("./public-update-admin-workspace.tsx");

    expect(service).toContain('method: selectedUpdate ? "PATCH" : "POST"');
    expect(service).toContain("canPreviewSavedUpdate(selectedUpdate, formIsDirty)");
    expect(service).toContain("setPreviewAcknowledgement(null)");
    expect(service).toContain("toPublishPayload(previewAcknowledgement)");
    expect(service).toContain('credentials: "include"');
    expect(service).toContain("headers: createApiHeaders()");
    expect(service).toContain("const interactionIsLocked = busyAction !== null");
    expect(service).toContain('window.addEventListener("beforeunload", handleBeforeUnload)');
    expect(rules).toContain('update.status === "draft" && update.visibility === "hidden" && !update.isExample');
    expect(rules).toContain('selectedUpdate.status === "draft"');
    expect(rules).toContain("previewMatchesSavedRevision");
    expect(client).toContain("Sign in required");
    expect(client).toContain("Forbidden");
    expect(client).toContain("Unavailable");
    expect(inventory).toContain("No matching updates.");
    expect(workspace).toContain("Unsaved");
    expect(workspace).toContain("Current revision reviewed");
    expect(workspace).toContain("Protected");
  });
});
