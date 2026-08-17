"use client";

import { useEffect, useState } from "react";

import { createApiHeaders } from "../dev-auth-token";
import styles from "./account.module.css";
import type { DomainUserProfile, ProviderProfileOption } from "./account.types";

const maxUploadBytes = 5 * 1024 * 1024;

type ProfileIdentitySettingsProps = {
  profile: DomainUserProfile;
  loadingProviderOptions: boolean;
  providerOptions: readonly ProviderProfileOption[];
  onUpdated: (profile: DomainUserProfile) => void;
  onMessage: (message: string) => void;
};

type ProfileUpdateResponse = {
  ok: true;
  domainUser: DomainUserProfile;
} | {
  ok: false;
  reason: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const providerLabels: Readonly<Record<string, string>> = {
  discord: "Discord",
  github: "GitHub",
  google: "Google",
  twitch: "Twitch"
};

const readFileAsBase64 = async (file: File): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const separator = result.indexOf(",");

      if (separator < 0) {
        reject(new Error("Could not read that image."));
        return;
      }

      resolve(result.slice(separator + 1));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Could not read that image.")));
    reader.readAsDataURL(file);
  });

const ProfileIdentitySettings = ({
  profile,
  loadingProviderOptions,
  providerOptions,
  onUpdated,
  onMessage
}: ProfileIdentitySettingsProps): React.ReactNode => {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [savingName, setSavingName] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [applyingProviderAccountId, setApplyingProviderAccountId] = useState<string | null>(null);

  useEffect(() => {
    setDisplayName(profile.displayName);
  }, [profile.displayName]);

  const saveDisplayName = async (): Promise<void> => {
    setSavingName(true);

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/profile`, {
        method: "PUT",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ displayName })
      });
      const result = await response.json() as ProfileUpdateResponse;

      if (!response.ok || !result.ok) {
        throw new Error("Use a name between 2 and 40 characters.");
      }

      onUpdated(result.domainUser);
      onMessage("Account name saved.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not save your account name.");
    } finally {
      setSavingName(false);
    }
  };

  const uploadImage = async (file: File | null): Promise<void> => {
    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/") || file.size > maxUploadBytes) {
      onMessage("Choose a JPEG, PNG, or WebP image up to 5 MB.");
      return;
    }

    setSavingImage(true);

    try {
      const dataBase64 = await readFileAsBase64(file);
      const response = await fetch(`${apiBaseUrl}/account/domain/profile-image`, {
        method: "PUT",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({ dataBase64 })
      });
      const result = await response.json() as ProfileUpdateResponse;

      if (!response.ok || !result.ok) {
        throw new Error("That image could not be processed.");
      }

      onUpdated(result.domainUser);
      onMessage("Profile image replaced.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not upload your profile image.");
    } finally {
      setSavingImage(false);
    }
  };

  const removeImage = async (): Promise<void> => {
    setSavingImage(true);

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/profile-image`, {
        method: "DELETE",
        headers: createApiHeaders(),
        credentials: "include"
      });
      const result = await response.json() as ProfileUpdateResponse;

      if (!response.ok || !result.ok) {
        throw new Error("Could not remove your profile image.");
      }

      onUpdated(result.domainUser);
      onMessage("Profile image removed.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not remove your profile image.");
    } finally {
      setSavingImage(false);
    }
  };

  const applyProviderProfile = async (
    option: ProviderProfileOption,
    selection: "name" | "image" | "both"
  ): Promise<void> => {
    setApplyingProviderAccountId(option.accountId);

    try {
      const response = await fetch(`${apiBaseUrl}/account/domain/provider-profile`, {
        method: "PUT",
        headers: createApiHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify({
          accountId: option.accountId,
          useDisplayName: selection === "name" || selection === "both",
          useImage: selection === "image" || selection === "both"
        })
      });
      const result = await response.json() as ProfileUpdateResponse;

      if (!response.ok || !result.ok) {
        throw new Error("That connected account profile is unavailable right now.");
      }

      onUpdated(result.domainUser);
      onMessage(`${providerLabels[option.providerId] ?? option.providerId} profile choice saved.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "Could not use that connected account profile.");
    } finally {
      setApplyingProviderAccountId(null);
    }
  };

  return (
    <div className={styles.profileEditor}>
      <div className={styles.profilePreview}>
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="Your current profile" src={profile.avatarUrl} />
        ) : (
          <span aria-hidden="true">{profile.displayName.slice(0, 1).toUpperCase()}</span>
        )}
      </div>

      <div className={styles.profileFields}>
        <label>
          <span>Account name</span>
          <input
            type="text"
            minLength={2}
            maxLength={40}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="nickname"
          />
        </label>
        <button
          type="button"
          className={styles.actionButton}
          disabled={savingName || displayName.trim() === profile.displayName}
          onClick={() => void saveDisplayName()}
        >
          {savingName ? "Saving..." : "Save name"}
        </button>

        <div className={styles.imageActions}>
          <label className={styles.fileButton}>
            <span>{savingImage ? "Processing..." : profile.avatarUrl ? "Replace image" : "Upload image"}</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={savingImage}
              onChange={(event) => {
                void uploadImage(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>
          {profile.avatarUrl ? (
            <button type="button" className={styles.textButton} disabled={savingImage} onClick={() => void removeImage()}>
              Remove image
            </button>
          ) : null}
        </div>
        <p>Images are cropped to a square. Uploading another image permanently replaces the previous one.</p>
      </div>

      <div className={styles.providerProfileChoices}>
        <div>
          <h3>Use a connected account</h3>
          <p>Copy a name, image, or both. This never changes that provider account.</p>
        </div>
        {loadingProviderOptions ? (
          <p>Checking connected accounts...</p>
        ) : providerOptions.length > 0 ? providerOptions.map((option) => {
          const applying = applyingProviderAccountId === option.accountId;

          return (
            <article className={styles.providerProfileChoice} key={option.accountId}>
              {option.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" src={option.imageUrl} />
              ) : (
                <span className={styles.providerProfilePlaceholder} aria-hidden="true">
                  {option.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <strong>{option.displayName}</strong>
                <span>{option.email ? `${providerLabels[option.providerId] ?? option.providerId} - ${option.email}` : providerLabels[option.providerId] ?? option.providerId}</span>
              </div>
              <div className={styles.providerProfileActions}>
                <button
                  type="button"
                  className={styles.textButton}
                  disabled={applyingProviderAccountId !== null}
                  onClick={() => void applyProviderProfile(option, "name")}
                >
                  Use name
                </button>
                <button
                  type="button"
                  className={styles.textButton}
                  disabled={!option.imageUrl || applyingProviderAccountId !== null}
                  onClick={() => void applyProviderProfile(option, "image")}
                >
                  Use image
                </button>
                <button
                  type="button"
                  className={styles.actionButton}
                  disabled={!option.imageUrl || applyingProviderAccountId !== null}
                  onClick={() => void applyProviderProfile(option, "both")}
                >
                  {applying ? "Saving..." : "Use both"}
                </button>
              </div>
            </article>
          );
        }) : (
          <p>No connected account profiles are available right now.</p>
        )}
      </div>
    </div>
  );
};

export default ProfileIdentitySettings;
