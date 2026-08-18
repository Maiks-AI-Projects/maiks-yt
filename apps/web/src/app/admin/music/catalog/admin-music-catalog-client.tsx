"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

import { captureDevAuthTokenFromUrl } from "../../../dev-auth-token";
import { MusicSearchableSelect } from "../../../music/components";
import {
  createAdminMusicRecord,
  updateAdminMusicRecord
} from "../../../music/music-api.service";
import type { MusicAdminOverview } from "../../../music/music-api.types";
import {
  adminTrackToMusicSelectTrack,
  formatMusicDuration
} from "../../../music/music-track-mapping.service";
import styles from "../../../music/music.module.css";
import {
  emptyMusicAdminOverview,
  loadMusicAdminOverview,
  stringValue,
  type MusicAdminLoadState
} from "../admin-music-data.service";
import {
  CompactRows,
  MusicAdminHeader,
  MusicAdminStatus
} from "../admin-music-shared";
import {
  LicenseSnapshotForm,
  LicenseSnapshotSelector,
  ProviderPolicyForm,
  SourceForm,
  SourceSelector,
  TrackForm
} from "./admin-music-catalog-forms";
import {
  buildLicenseSnapshotPayload,
  buildProviderPolicyPayload,
  buildSourcePayload,
  buildTrackPayload,
  isSourceTypeOption,
  type SourceTypeOption
} from "./admin-music-catalog-form-data";

const AdminMusicCatalogClient = (): React.ReactNode => {
  const [loadState, setLoadState] = useState<MusicAdminLoadState>("loading");
  const [message, setMessage] = useState("Author provider policies, catalog tracks, sources, and license snapshots.");
  const [overview, setOverview] = useState<MusicAdminOverview>(emptyMusicAdminOverview);
  const [selectedLicenseSnapshotId, setSelectedLicenseSnapshotId] = useState<string | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [sourceDraftType, setSourceDraftType] = useState<SourceTypeOption>("external_url");

  const selectableTracks = useMemo(() => overview.tracks.map(adminTrackToMusicSelectTrack), [overview.tracks]);
  const selectedPolicy = useMemo(
    () => overview.providerPolicies.find((policy) => policy.id === selectedPolicyId) ?? null,
    [overview.providerPolicies, selectedPolicyId]
  );
  const selectedTrack = useMemo(
    () => overview.tracks.find((track) => track.id === selectedTrackId) ?? null,
    [overview.tracks, selectedTrackId]
  );
  const selectedSource = useMemo(
    () => selectedTrack?.sources.find((source) => source.id === selectedSourceId) ?? null,
    [selectedSourceId, selectedTrack]
  );
  const sourceLicenseSnapshots = useMemo(
    () => selectedTrack?.licenseSnapshots.filter((snapshot) => snapshot.sourceId === selectedSourceId) ?? [],
    [selectedSourceId, selectedTrack]
  );
  const selectedLicenseSnapshot = useMemo(
    () => sourceLicenseSnapshots.find((snapshot) => snapshot.id === selectedLicenseSnapshotId) ?? null,
    [selectedLicenseSnapshotId, sourceLicenseSnapshots]
  );

  const refresh = async (): Promise<void> => {
    setLoadState("loading");
    const result = await loadMusicAdminOverview();
    setLoadState(result.loadState);
    setOverview(result.overview);
  };

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void refresh();
  }, []);

  useEffect(() => {
    if (!selectedTrack) {
      setSelectedSourceId(null);
      setSelectedLicenseSnapshotId(null);
      return;
    }

    if (selectedSourceId && !selectedTrack.sources.some((source) => source.id === selectedSourceId)) {
      setSelectedSourceId(null);
    }
  }, [selectedSourceId, selectedTrack]);

  useEffect(() => {
    if (!selectedSourceId) {
      setSelectedLicenseSnapshotId(null);
      return;
    }

    if (selectedLicenseSnapshotId && !sourceLicenseSnapshots.some((snapshot) => snapshot.id === selectedLicenseSnapshotId)) {
      setSelectedLicenseSnapshotId(null);
    }
  }, [selectedLicenseSnapshotId, selectedSourceId, sourceLicenseSnapshots]);

  useEffect(() => {
    setSourceDraftType(isSourceTypeOption(selectedSource?.sourceType) ? selectedSource.sourceType : "external_url");
  }, [selectedSource]);

  const submitMutation = async (
    event: FormEvent<HTMLFormElement>,
    method: "POST" | "PUT",
    path: string,
    body: Record<string, unknown>,
    successMessage: string
  ): Promise<void> => {
    event.preventDefault();
    setMessage("Saving music catalog record...");
    try {
      const response = method === "POST"
        ? await createAdminMusicRecord(path, body)
        : await updateAdminMusicRecord(path, body);

      if (!response.payload.ok) {
        setMessage(`Save blocked: ${response.payload.reason}`);
        return;
      }

      setMessage(successMessage);
      await refresh();
    } catch {
      setMessage("Music catalog save failed.");
    }
  };

  const submitProviderPolicy = (event: FormEvent<HTMLFormElement>): void => {
    const body = buildProviderPolicyPayload(new FormData(event.currentTarget));
    const path = selectedPolicy
      ? `/admin/music/provider-policies/${encodeURIComponent(selectedPolicy.id)}`
      : "/admin/music/provider-policies";
    void submitMutation(event, selectedPolicy ? "PUT" : "POST", path, body, selectedPolicy ? "Provider policy updated." : "Provider policy saved.");
  };

  const submitTrack = (event: FormEvent<HTMLFormElement>): void => {
    const body = buildTrackPayload(new FormData(event.currentTarget));
    const path = selectedTrack
      ? `/admin/music/catalog/${encodeURIComponent(selectedTrack.id)}`
      : "/admin/music/catalog";
    void submitMutation(event, selectedTrack ? "PUT" : "POST", path, body, selectedTrack ? "Catalog track updated." : "Catalog track saved.");
  };

  const submitSource = (event: FormEvent<HTMLFormElement>): void => {
    const data = new FormData(event.currentTarget);
    const result = buildSourcePayload(data);

    if (result.error) {
      event.preventDefault();
      setMessage(result.error);
      return;
    }

    const trackId = selectedTrack?.id ?? stringValue(data, "trackId");
    const path = selectedSource
      ? `/admin/music/sources/${encodeURIComponent(selectedSource.id)}`
      : `/admin/music/catalog/${encodeURIComponent(trackId)}/sources`;

    void submitMutation(event, selectedSource ? "PUT" : "POST", path, result.payload, selectedSource ? "Track source updated." : "Track source saved.");
  };

  const submitLicenseSnapshot = (event: FormEvent<HTMLFormElement>): void => {
    const data = new FormData(event.currentTarget);
    const sourceId = selectedSource?.id ?? stringValue(data, "sourceId");
    const body = buildLicenseSnapshotPayload(data, selectedTrack?.id ?? null, selectedSource?.id ?? null);
    const path = selectedLicenseSnapshot
      ? `/admin/music/license-snapshots/${encodeURIComponent(selectedLicenseSnapshot.id)}`
      : `/admin/music/sources/${encodeURIComponent(sourceId)}/license-snapshots`;

    void submitMutation(
      event,
      selectedLicenseSnapshot ? "PUT" : "POST",
      path,
      body,
      selectedLicenseSnapshot ? "License snapshot updated." : "License snapshot saved."
    );
  };

  return (
    <>
      <MusicAdminHeader
        description="Provider policy plus track, source, and license authoring."
        title="Music Catalog"
      />
      <MusicAdminStatus
        countLabel={`${overview.providerPolicies.length} policies / ${overview.tracks.length} tracks`}
        loadState={loadState}
        message={message}
        onRefresh={() => void refresh()}
      />

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Provider Policy</h2>
            <p>{selectedPolicy ? `Editing ${selectedPolicy.displayName}` : "Create a new provider policy."}</p>
          </div>
          {selectedPolicy ? (
            <button className={styles.textButton} onClick={() => setSelectedPolicyId(null)} type="button">New policy</button>
          ) : null}
        </div>
        <label className={styles.compactSelect}>
          <span>Existing policy</span>
          <select
            onChange={(event) => setSelectedPolicyId(event.currentTarget.value || null)}
            value={selectedPolicyId ?? ""}
          >
            <option value="">New provider policy</option>
            {overview.providerPolicies.map((policy) => (
              <option key={policy.id} value={policy.id}>{policy.displayName} / {policy.providerKey}</option>
            ))}
          </select>
        </label>
        <ProviderPolicyForm
          key={selectedPolicy?.id ?? "new-policy"}
          onSubmit={submitProviderPolicy}
          policy={selectedPolicy}
        />
      </section>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Track</h2>
            <p>{selectedTrack ? `Editing ${selectedTrack.title}` : "Create a new track record."}</p>
          </div>
          {selectedTrack ? (
            <button className={styles.textButton} onClick={() => setSelectedTrackId(null)} type="button">New track</button>
          ) : null}
        </div>
        <MusicSearchableSelect
          label="Existing catalog track"
          onSelectedTrackChange={(track) => setSelectedTrackId(track?.id ?? null)}
          safetyContext="none"
          selectedTrackId={selectedTrackId}
          tracks={selectableTracks}
        />
        <TrackForm
          key={selectedTrack?.id ?? "new-track"}
          onSubmit={submitTrack}
          track={selectedTrack}
        />
        <CompactRows
          emptyLabel="No catalog tracks returned."
          rows={overview.tracks.map((track) => ({
            action: `${track.sources.length} sources / ${track.licenseSnapshots.length} licenses`,
            meta: `${track.artist} / ${formatMusicDuration(track.durationSeconds)}`,
            state: `${track.rightsState} / ${track.reviewState}`,
            title: track.title
          }))}
        />
      </section>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>Source</h2>
            <p>{selectedSource ? `Editing ${selectedSource.sourceLabel}` : "Create a source for the selected track."}</p>
          </div>
          {selectedSource ? (
            <button className={styles.textButton} onClick={() => setSelectedSourceId(null)} type="button">New source</button>
          ) : null}
        </div>
        <SourceSelector
          onSelectedSourceIdChange={setSelectedSourceId}
          selectedSourceId={selectedSourceId}
          sources={selectedTrack?.sources ?? []}
        />
        <SourceForm
          key={selectedSource?.id ?? `${selectedTrack?.id ?? "none"}-new-source`}
          onSourceTypeChange={setSourceDraftType}
          onSubmit={submitSource}
          selectedTrack={selectedTrack}
          source={selectedSource}
          sourceDraftType={sourceDraftType}
        />
      </section>

      <section className={styles.adminSection}>
        <div className={styles.sectionHeader}>
          <div>
            <h2>License Snapshot</h2>
            <p>{selectedLicenseSnapshot ? `Editing ${selectedLicenseSnapshot.licenseName}` : "Create a license snapshot for the selected source."}</p>
          </div>
          {selectedLicenseSnapshot ? (
            <button className={styles.textButton} onClick={() => setSelectedLicenseSnapshotId(null)} type="button">New license</button>
          ) : null}
        </div>
        <LicenseSnapshotSelector
          licenseSnapshots={sourceLicenseSnapshots}
          onSelectedLicenseSnapshotIdChange={setSelectedLicenseSnapshotId}
          selectedLicenseSnapshotId={selectedLicenseSnapshotId}
        />
        <LicenseSnapshotForm
          key={selectedLicenseSnapshot?.id ?? `${selectedSource?.id ?? "none"}-new-license`}
          licenseSnapshot={selectedLicenseSnapshot}
          onSubmit={submitLicenseSnapshot}
          selectedSource={selectedSource}
        />
      </section>
    </>
  );
};

export default AdminMusicCatalogClient;
