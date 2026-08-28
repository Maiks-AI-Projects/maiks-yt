export const sourceSelectionRequiredMessage = "Select a catalog track before saving a source.";
export const licenseSnapshotSelectionRequiredMessage = "Select a source before saving a license snapshot.";

export type MusicCatalogMutationPath = {
  readonly method: "POST" | "PUT";
  readonly path: string;
};

export const removePrivateMusicCatalogSelectionFields = (data: FormData): void => {
  data.delete("trackId");
  data.delete("sourceId");
};

export const buildSourceMutationPath = (
  selectedTrackId: string | null,
  selectedSourceId: string | null
): MusicCatalogMutationPath | null => {
  if (!selectedTrackId) {
    return null;
  }

  return selectedSourceId
    ? {
      method: "PUT",
      path: `/admin/music/sources/${encodeURIComponent(selectedSourceId)}`
    }
    : {
      method: "POST",
      path: `/admin/music/catalog/${encodeURIComponent(selectedTrackId)}/sources`
    };
};

export const buildLicenseSnapshotMutationPath = (
  selectedSourceId: string | null,
  selectedLicenseSnapshotId: string | null
): MusicCatalogMutationPath | null => {
  if (!selectedSourceId) {
    return null;
  }

  return selectedLicenseSnapshotId
    ? {
      method: "PUT",
      path: `/admin/music/license-snapshots/${encodeURIComponent(selectedLicenseSnapshotId)}`
    }
    : {
      method: "POST",
      path: `/admin/music/sources/${encodeURIComponent(selectedSourceId)}/license-snapshots`
    };
};
