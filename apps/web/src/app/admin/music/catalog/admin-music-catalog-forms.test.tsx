import { act, create, type ReactTestRenderer } from "react-test-renderer";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  MusicLicenseSnapshotRecord,
  MusicProviderPolicyRecord,
  MusicTrackAdminRecord,
  MusicTrackSourceRecord
} from "../../../music/music-api.types";
import {
  buildLicenseSnapshotMutationPath,
  buildSourceMutationPath,
  licenseSnapshotSelectionRequiredMessage,
  removePrivateMusicCatalogSelectionFields,
  sourceSelectionRequiredMessage
} from "./admin-music-catalog.rules";
import {
  LicenseSnapshotForm,
  LicenseSnapshotSelector,
  SourceForm,
  SourceSelector
} from "./admin-music-catalog-forms";

const now = "2026-08-28T12:00:00.000Z";

const providerPolicy: MusicProviderPolicyRecord = {
  id: "policy-1",
  providerKey: "youtube",
  displayName: "YouTube Audio Library",
  providerType: "catalog",
  providerStatus: "allowed",
  rightsState: "eligible",
  publicRequestsEnabled: true,
  publicPlaybackEnabled: true,
  defaultLiveSafe: true,
  defaultVodSafe: true,
  attributionRequired: true,
  localCacheAllowed: true,
  policyUrl: "https://example.test/policy",
  termsUrl: null,
  notesPrivate: null,
  effectiveFrom: now,
  effectiveUntil: null,
  createdAt: now,
  updatedAt: now
};

const providerPolicies = [providerPolicy] as const;

const sourceRecord: MusicTrackSourceRecord = {
  id: "source-1",
  trackId: "track-1",
  providerPolicyId: "policy-1",
  providerKey: "youtube",
  sourceType: "external_url",
  sourceLabel: "Creator catalog",
  sourceExternalId: "yt-audio-1",
  sourceUrl: "https://example.test/source",
  previewUrl: "https://example.test/preview.mp3",
  previewMimeType: "audio/mpeg",
  storageRef: null,
  sha256: null,
  mimeType: "audio/mpeg",
  durationSeconds: 123,
  rightsState: "eligible",
  availabilityStatus: "available",
  attributionText: "Music by Artist",
  createdAt: now,
  updatedAt: now
};

const licenseSnapshot: MusicLicenseSnapshotRecord = {
  id: "license-1",
  trackId: "track-1",
  sourceId: "source-1",
  providerPolicyId: "policy-1",
  licenseName: "Creative Commons Attribution 4.0",
  licenseKind: "creative-commons",
  rightsState: "eligible",
  liveSafe: true,
  vodSafe: true,
  attributionRequired: true,
  attributionText: "Music by Artist",
  proofUrl: "https://example.test/license",
  validFrom: "2026-08-01",
  validUntil: null,
  capturedAt: now
};

const trackRecord: MusicTrackAdminRecord = {
  id: "track-1",
  slug: "track-one",
  title: "Track One",
  artist: "Artist",
  album: null,
  durationSeconds: 123,
  isrc: null,
  rightsState: "eligible",
  reviewState: "approved",
  liveSafe: true,
  vodSafe: true,
  explicitContent: false,
  instrumental: true,
  safetyTags: [],
  notesPrivate: null,
  createdAt: now,
  updatedAt: now,
  sources: [sourceRecord],
  licenseSnapshots: [licenseSnapshot]
};

const render = (node: ReactElement): ReactTestRenderer => {
  let renderer: ReactTestRenderer | null = null;

  act(() => {
    renderer = create(node);
  });

  if (!renderer) {
    throw new Error("Renderer did not mount.");
  }

  return renderer;
};

const textOf = (renderer: ReactTestRenderer): string => JSON.stringify(renderer.toJSON());

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("admin music catalog dependent forms", () => {
  it("replaces raw track and source id entry with compact selection instructions", () => {
    const sourceForm = render(
      <SourceForm
        onSourceTypeChange={vi.fn()}
        onSubmit={vi.fn()}
        policies={providerPolicies}
        selectedTrack={null}
        source={null}
        sourceDraftType="external_url"
      />
    );

    expect(textOf(sourceForm)).toContain("Select a catalog track before creating or editing a source.");
    expect(textOf(sourceForm)).not.toContain("Track id");
    expect(sourceForm.root.findAllByType("form")).toHaveLength(0);
    expect(sourceForm.root.findAllByType("input").some((input) => input.props.name === "trackId")).toBe(false);

    const licenseForm = render(
      <LicenseSnapshotForm
        licenseSnapshot={null}
        onSubmit={vi.fn()}
        policies={providerPolicies}
        selectedSource={null}
      />
    );

    expect(textOf(licenseForm)).toContain("Select a source before creating or editing a license snapshot.");
    expect(textOf(licenseForm)).not.toContain("Source id");
    expect(licenseForm.root.findAllByType("form")).toHaveLength(0);
    expect(licenseForm.root.findAllByType("input").some((input) => input.props.name === "sourceId")).toBe(false);

    act(() => {
      sourceForm.unmount();
      licenseForm.unmount();
    });
  });

  it("keeps selected source and license editing fields without raw id inputs", () => {
    const sourceForm = render(
      <SourceForm
        onSourceTypeChange={vi.fn()}
        onSubmit={vi.fn()}
        policies={providerPolicies}
        selectedTrack={trackRecord}
        source={sourceRecord}
        sourceDraftType="external_url"
      />
    );
    const sourceLabelInput = sourceForm.root.findAllByType("input")
      .find((input) => input.props.name === "sourceLabel");

    expect(sourceForm.root.findAllByType("form")).toHaveLength(1);
    expect(sourceLabelInput?.props.defaultValue).toBe("Creator catalog");
    expect(sourceForm.root.findAllByType("input").some((input) => input.props.name === "trackId")).toBe(false);
    expect(sourceForm.root.findAllByType("input").some((input) => input.props.name === "providerPolicyId")).toBe(false);
    expect(sourceForm.root.findAllByType("select").find((select) => select.props.name === "providerPolicyId")?.props.defaultValue).toBe("policy-1");
    expect(textOf(sourceForm)).not.toContain("Track id");
    expect(textOf(sourceForm)).not.toContain("Policy id");
    expect(textOf(sourceForm)).toContain("No policy");
    expect(textOf(sourceForm)).toContain("YouTube Audio Library");
    expect(textOf(sourceForm)).toContain("youtube");
    expect(textOf(sourceForm)).toContain("Update source");

    const licenseForm = render(
      <LicenseSnapshotForm
        licenseSnapshot={licenseSnapshot}
        onSubmit={vi.fn()}
        policies={providerPolicies}
        selectedSource={sourceRecord}
      />
    );
    const licenseNameInput = licenseForm.root.findAllByType("input")
      .find((input) => input.props.name === "licenseName");

    expect(licenseForm.root.findAllByType("form")).toHaveLength(1);
    expect(licenseNameInput?.props.defaultValue).toBe("Creative Commons Attribution 4.0");
    expect(licenseForm.root.findAllByType("input").some((input) => input.props.name === "sourceId")).toBe(false);
    expect(licenseForm.root.findAllByType("input").some((input) => input.props.name === "providerPolicyId")).toBe(false);
    expect(licenseForm.root.findAllByType("select").find((select) => select.props.name === "providerPolicyId")?.props.defaultValue).toBe("policy-1");
    expect(textOf(licenseForm)).not.toContain("Source id");
    expect(textOf(licenseForm)).not.toContain("Policy id");
    expect(textOf(licenseForm)).toContain("No policy");
    expect(textOf(licenseForm)).toContain("YouTube Audio Library");
    expect(textOf(licenseForm)).toContain("youtube");
    expect(textOf(licenseForm)).toContain("Update license");

    act(() => {
      sourceForm.unmount();
      licenseForm.unmount();
    });
  });

  it("keeps operator-readable selected source and license selector display", () => {
    const sourceSelector = render(
      <SourceSelector
        onSelectedSourceIdChange={vi.fn()}
        selectedSourceId={sourceRecord.id}
        sources={[sourceRecord]}
      />
    );
    const selectedSourceSelect = sourceSelector.root.findByType("select");

    expect(selectedSourceSelect.props.value).toBe(sourceRecord.id);
    expect(textOf(sourceSelector)).toContain("Creator catalog");
    expect(textOf(sourceSelector)).toContain("external_url");
    expect(textOf(sourceSelector)).toContain("youtube");

    const licenseSelector = render(
      <LicenseSnapshotSelector
        licenseSnapshots={[licenseSnapshot]}
        onSelectedLicenseSnapshotIdChange={vi.fn()}
        selectedLicenseSnapshotId={licenseSnapshot.id}
      />
    );
    const selectedLicenseSelect = licenseSelector.root.findByType("select");

    expect(selectedLicenseSelect.props.value).toBe(licenseSnapshot.id);
    expect(textOf(licenseSelector)).toContain("Creative Commons Attribution 4.0");
    expect(textOf(licenseSelector)).toContain("creative-commons");

    act(() => {
      sourceSelector.unmount();
      licenseSelector.unmount();
    });
  });

  it("does not construct source or license mutation paths without required selections", () => {
    expect(buildSourceMutationPath(null, null)).toBeNull();
    expect(buildLicenseSnapshotMutationPath(null, null)).toBeNull();
    expect(sourceSelectionRequiredMessage).toBe("Select a catalog track before saving a source.");
    expect(licenseSnapshotSelectionRequiredMessage).toBe("Select a source before saving a license snapshot.");
  });

  it("removes stale private selection fields before payload building", () => {
    const data = new FormData();
    data.set("trackId", "pasted-track");
    data.set("sourceId", "pasted-source");
    data.set("providerPolicyId", "policy-1");

    removePrivateMusicCatalogSelectionFields(data);

    expect(data.has("trackId")).toBe(false);
    expect(data.has("sourceId")).toBe(false);
    expect(data.get("providerPolicyId")).toBe("policy-1");
  });

  it("keeps private selected ids only in API mutation paths when selections exist", () => {
    expect(buildSourceMutationPath("track/one", null)).toEqual({
      method: "POST",
      path: "/admin/music/catalog/track%2Fone/sources"
    });
    expect(buildSourceMutationPath("track/one", "source/one")).toEqual({
      method: "PUT",
      path: "/admin/music/sources/source%2Fone"
    });
    expect(buildLicenseSnapshotMutationPath("source/one", null)).toEqual({
      method: "POST",
      path: "/admin/music/sources/source%2Fone/license-snapshots"
    });
    expect(buildLicenseSnapshotMutationPath("source/one", "license/one")).toEqual({
      method: "PUT",
      path: "/admin/music/license-snapshots/license%2Fone"
    });
  });
});
