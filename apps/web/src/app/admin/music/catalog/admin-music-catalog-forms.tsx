import { type FormEvent } from "react";

import type {
  MusicLicenseSnapshotRecord,
  MusicProviderPolicyRecord,
  MusicTrackAdminRecord,
  MusicTrackSourceRecord
} from "../../../music/music-api.types";
import styles from "../../../music/music.module.css";
import {
  CheckboxField,
  SelectField,
  TextField
} from "../admin-music-shared";
import {
  availabilityStatusOptions,
  isSourceTypeOption,
  licenseKindOptions,
  providerStatusOptions,
  providerTypeOptions,
  rightsStateOptions,
  sourceTypeOptions,
  trackReviewStateOptions,
  type SourceTypeOption
} from "./admin-music-catalog-form-data";

export const ProviderPolicyForm = ({ onSubmit, policy }: {
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly policy: MusicProviderPolicyRecord | null;
}): React.ReactNode => (
  <form className={styles.formGrid} onSubmit={onSubmit}>
    <TextField defaultValue={policy?.providerKey} name="providerKey" label="Provider key" required />
    <TextField defaultValue={policy?.displayName} name="displayName" label="Display name" required />
    <SelectField defaultValue={policy?.providerType} name="providerType" label="Type" options={providerTypeOptions} />
    <SelectField defaultValue={policy?.providerStatus} name="providerStatus" label="Status" options={providerStatusOptions} />
    <SelectField defaultValue={policy?.rightsState} name="rightsState" label="Rights" options={rightsStateOptions} />
    <TextField defaultValue={policy?.policyUrl ?? ""} name="policyUrl" label="Policy URL" />
    <TextField defaultValue={policy?.termsUrl ?? ""} name="termsUrl" label="Terms URL" />
    <TextField defaultValue={policy?.effectiveUntil ?? ""} name="effectiveUntil" label="Effective until" />
    <CheckboxField defaultChecked={policy?.publicRequestsEnabled ?? false} name="publicRequestsEnabled" label="Public requests" />
    <CheckboxField defaultChecked={policy?.publicPlaybackEnabled ?? false} name="publicPlaybackEnabled" label="Public playback" />
    <CheckboxField defaultChecked={policy?.defaultLiveSafe ?? false} name="defaultLiveSafe" label="Live safe default" />
    <CheckboxField defaultChecked={policy?.defaultVodSafe ?? false} name="defaultVodSafe" label="VOD safe default" />
    <CheckboxField defaultChecked={policy?.attributionRequired ?? true} name="attributionRequired" label="Attribution required" />
    <CheckboxField defaultChecked={policy?.localCacheAllowed ?? false} name="localCacheAllowed" label="Local cache allowed" />
    <label className={styles.wideField}><span>Private notes</span><textarea defaultValue={policy?.notesPrivate ?? ""} name="notesPrivate" /></label>
    <button className={styles.primaryButton} type="submit">{policy ? "Update policy" : "Save policy"}</button>
  </form>
);

export const TrackForm = ({ onSubmit, track }: {
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly track: MusicTrackAdminRecord | null;
}): React.ReactNode => (
  <form className={styles.formGrid} onSubmit={onSubmit}>
    <TextField defaultValue={track?.slug} name="slug" label="Slug" required />
    <TextField defaultValue={track?.title} name="title" label="Title" required />
    <TextField defaultValue={track?.artist} name="artist" label="Artist" required />
    <TextField defaultValue={track?.album ?? ""} name="album" label="Album" />
    <TextField defaultValue={track?.durationSeconds?.toString() ?? ""} name="durationSeconds" label="Duration seconds" type="number" />
    <TextField defaultValue={track?.isrc ?? ""} name="isrc" label="ISRC" />
    <SelectField defaultValue={track?.rightsState} name="rightsState" label="Rights" options={rightsStateOptions} />
    <SelectField defaultValue={track?.reviewState} name="reviewState" label="Review" options={trackReviewStateOptions} />
    <TextField defaultValue={track?.safetyTags.join(", ") ?? ""} name="safetyTags" label="Safety tags" placeholder="comma, separated" />
    <CheckboxField defaultChecked={track?.liveSafe ?? false} name="liveSafe" label="Live safe" />
    <CheckboxField defaultChecked={track?.vodSafe ?? false} name="vodSafe" label="VOD safe" />
    <CheckboxField defaultChecked={track?.explicitContent ?? false} name="explicitContent" label="Explicit" />
    <CheckboxField defaultChecked={track?.instrumental ?? false} name="instrumental" label="Instrumental" />
    <label className={styles.wideField}><span>Private notes</span><textarea defaultValue={track?.notesPrivate ?? ""} name="notesPrivate" /></label>
    <button className={styles.primaryButton} type="submit">{track ? "Update track" : "Save track"}</button>
  </form>
);

export const SourceSelector = ({ onSelectedSourceIdChange, selectedSourceId, sources }: {
  readonly onSelectedSourceIdChange: (sourceId: string | null) => void;
  readonly selectedSourceId: string | null;
  readonly sources: readonly MusicTrackSourceRecord[];
}): React.ReactNode => (
  <label className={styles.compactSelect}>
    <span>Existing source</span>
    <select
      disabled={sources.length === 0}
      onChange={(event) => onSelectedSourceIdChange(event.currentTarget.value || null)}
      value={selectedSourceId ?? ""}
    >
      <option value="">New source</option>
      {sources.map((source) => (
        <option key={source.id} value={source.id}>{source.sourceLabel} / {source.sourceType} / {source.providerKey}</option>
      ))}
    </select>
  </label>
);

const ProviderPolicySelect = ({ defaultValue, policies }: {
  readonly defaultValue: string | null | undefined;
  readonly policies: readonly MusicProviderPolicyRecord[];
}): React.ReactNode => (
  <label>
    <span>Policy</span>
    <select defaultValue={defaultValue ?? ""} name="providerPolicyId">
      <option value="">No policy</option>
      {policies.map((policy) => (
        <option key={policy.id} value={policy.id}>{policy.displayName} / {policy.providerKey}</option>
      ))}
    </select>
  </label>
);

export const SourceForm = ({ onSourceTypeChange, onSubmit, policies, selectedTrack, source, sourceDraftType }: {
  readonly onSourceTypeChange: (sourceType: SourceTypeOption) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly policies: readonly MusicProviderPolicyRecord[];
  readonly selectedTrack: MusicTrackAdminRecord | null;
  readonly source: MusicTrackSourceRecord | null;
  readonly sourceDraftType: SourceTypeOption;
}): React.ReactNode => {
  const selectedSourceType = isSourceTypeOption(source?.sourceType) ? source.sourceType : sourceDraftType;

  if (!selectedTrack) {
    return <p className={styles.emptyState}>Select a catalog track before creating or editing a source.</p>;
  }

  return (
    <form className={styles.formGrid} onSubmit={onSubmit}>
      <TextField defaultValue={source?.providerKey ?? ""} name="providerKey" label="Provider key" required />
      <ProviderPolicySelect defaultValue={source?.providerPolicyId} policies={policies} />
      <label>
        <span>Source type</span>
        <select
          defaultValue={selectedSourceType}
          name="sourceType"
          onChange={(event) => {
            const value = event.currentTarget.value;
            if (isSourceTypeOption(value)) {
              onSourceTypeChange(value);
            }
          }}
        >
          {sourceTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </label>
      <TextField defaultValue={source?.sourceLabel ?? ""} name="sourceLabel" label="Source label" required />
      <TextField defaultValue={source?.sourceExternalId ?? ""} name="sourceExternalId" label="External id" />
      <TextField
        disabled={selectedSourceType === "local_audio"}
        defaultValue={selectedSourceType === "local_audio" ? "" : source?.sourceUrl ?? ""}
        name="sourceUrl"
        label="Source URL"
      />
      <TextField defaultValue={source?.previewUrl ?? ""} name="previewUrl" label="Preview URL" />
      <TextField defaultValue={source?.previewMimeType ?? ""} name="previewMimeType" label="Preview MIME" placeholder="audio/mpeg" />
      <TextField defaultValue={source?.storageRef ?? ""} name="storageRef" label="Storage ref" required={selectedSourceType === "local_audio"} />
      <TextField defaultValue={source?.sha256 ?? ""} name="sha256" label="SHA-256" required={selectedSourceType === "local_audio"} />
      <TextField defaultValue={source?.mimeType ?? ""} name="mimeType" label="Source MIME" />
      <TextField defaultValue={source?.durationSeconds?.toString() ?? ""} name="durationSeconds" label="Duration seconds" type="number" />
      <SelectField defaultValue={source?.rightsState} name="rightsState" label="Rights" options={rightsStateOptions} />
      <SelectField defaultValue={source?.availabilityStatus} name="availabilityStatus" label="Availability" options={availabilityStatusOptions} />
      <TextField defaultValue={source?.attributionText ?? ""} name="attributionText" label="Attribution" />
      <button className={styles.primaryButton} type="submit">{source ? "Update source" : "Save source"}</button>
    </form>
  );
};

export const LicenseSnapshotSelector = ({ licenseSnapshots, onSelectedLicenseSnapshotIdChange, selectedLicenseSnapshotId }: {
  readonly licenseSnapshots: readonly MusicLicenseSnapshotRecord[];
  readonly onSelectedLicenseSnapshotIdChange: (licenseSnapshotId: string | null) => void;
  readonly selectedLicenseSnapshotId: string | null;
}): React.ReactNode => (
  <label className={styles.compactSelect}>
    <span>Existing license</span>
    <select
      disabled={licenseSnapshots.length === 0}
      onChange={(event) => onSelectedLicenseSnapshotIdChange(event.currentTarget.value || null)}
      value={selectedLicenseSnapshotId ?? ""}
    >
      <option value="">New license snapshot</option>
      {licenseSnapshots.map((snapshot) => (
        <option key={snapshot.id} value={snapshot.id}>{snapshot.licenseName} / {snapshot.licenseKind}</option>
      ))}
    </select>
  </label>
);

export const LicenseSnapshotForm = ({ licenseSnapshot, onSubmit, policies, selectedSource }: {
  readonly licenseSnapshot: MusicLicenseSnapshotRecord | null;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly policies: readonly MusicProviderPolicyRecord[];
  readonly selectedSource: MusicTrackSourceRecord | null;
}): React.ReactNode => {
  if (!selectedSource) {
    return <p className={styles.emptyState}>Select a source before creating or editing a license snapshot.</p>;
  }

  return (
    <form className={styles.formGrid} onSubmit={onSubmit}>
      <ProviderPolicySelect defaultValue={licenseSnapshot?.providerPolicyId ?? selectedSource.providerPolicyId} policies={policies} />
      <TextField defaultValue={licenseSnapshot?.licenseName ?? ""} name="licenseName" label="License name" required />
      <SelectField defaultValue={licenseSnapshot?.licenseKind ?? "platform-library"} name="licenseKind" label="License kind" options={licenseKindOptions} />
      <SelectField defaultValue={licenseSnapshot?.rightsState} name="rightsState" label="Rights" options={rightsStateOptions} />
      <TextField defaultValue={licenseSnapshot?.proofUrl ?? ""} name="proofUrl" label="Proof URL" />
      <TextField name="proofStorageRef" label="Proof storage ref" />
      <TextField defaultValue={licenseSnapshot?.validFrom ?? ""} name="validFrom" label="Valid from" />
      <TextField defaultValue={licenseSnapshot?.validUntil ?? ""} name="validUntil" label="Valid until" />
      <TextField defaultValue={licenseSnapshot?.attributionText ?? ""} name="attributionText" label="Attribution" />
      <CheckboxField defaultChecked={licenseSnapshot?.liveSafe ?? false} name="liveSafe" label="Live safe" />
      <CheckboxField defaultChecked={licenseSnapshot?.vodSafe ?? false} name="vodSafe" label="VOD safe" />
      <CheckboxField defaultChecked={licenseSnapshot?.attributionRequired ?? true} name="attributionRequired" label="Attribution required" />
      <button className={styles.primaryButton} type="submit">{licenseSnapshot ? "Update license" : "Save license"}</button>
    </form>
  );
};
