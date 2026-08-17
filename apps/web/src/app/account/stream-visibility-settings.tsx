"use client";

import type { StreamVisibilityPreferenceScope } from "@maiks-yt/domain/events";
import * as Switch from "@radix-ui/react-switch";
import { useId } from "react";

import AccountControlTooltip from "./account-control-tooltip";
import styles from "./account.module.css";
import type { StreamVisibilityPreference } from "./account.types";

type StreamVisibilitySettingsProps = {
  globalPreference: StreamVisibilityPreference | undefined;
  perEventPreferences: readonly StreamVisibilityPreference[];
  savingScope: StreamVisibilityPreferenceScope | null;
  onChange: (scope: StreamVisibilityPreferenceScope, optedOut: boolean) => void;
};

type VisibilityToggleProps = {
  preference: StreamVisibilityPreference;
  saving: boolean;
  onChange: (scope: StreamVisibilityPreferenceScope, optedOut: boolean) => void;
};

const VisibilityToggle = ({ preference, saving, onChange }: VisibilityToggleProps): React.ReactNode => {
  const switchId = useId();
  const switchLabelId = useId();
  const status = preference.optedOut ? "Hidden" : "Allowed";

  return (
    <div className={styles.visibilityRow}>
      <div>
        <strong>{preference.label}</strong>
        <span>{preference.description}</span>
      </div>
      <div className={styles.visibilityControls}>
        <AccountControlTooltip text={`Turn on to show ${preference.label.toLowerCase()} on stream.`}>
          <span className={styles.tooltipTrigger}>
            <label className={styles.streamSwitchControl} htmlFor={switchId}>
              <Switch.Root
                id={switchId}
                className={styles.streamSwitch}
                checked={!preference.optedOut}
                disabled={saving}
                onCheckedChange={(checked) => onChange(preference.scope, !checked)}
                aria-labelledby={switchLabelId}
              >
                <Switch.Thumb className={styles.streamSwitchThumb} />
              </Switch.Root>
              <span className={styles.streamSwitchLabel} id={switchLabelId}>
                Show on stream
                <span className={styles.visuallyHidden}> for {preference.label}</span>
              </span>
            </label>
          </span>
        </AccountControlTooltip>
        <div className={styles.visibilityStatusGroup}>
          <span
            className={
              preference.optedOut ? styles.visibilityStatusHidden : styles.visibilityStatusAllowed
            }
            aria-live="polite"
          >
            {status}
          </span>
          {saving ? <span className={styles.savingLabel}>Saving</span> : null}
        </div>
      </div>
    </div>
  );
};

const StreamVisibilitySettings = ({
  globalPreference,
  perEventPreferences,
  savingScope,
  onChange
}: StreamVisibilitySettingsProps): React.ReactNode => (
  <div className={styles.visibilitySettings}>
    {globalPreference ? (
      <div className={styles.globalVisibility}>
        <VisibilityToggle
          preference={globalPreference}
          saving={savingScope !== null}
          onChange={onChange}
        />
      </div>
    ) : null}
    {perEventPreferences.length > 0 ? (
      <details className={styles.details}>
        <summary>Individual appearance controls</summary>
        <div className={styles.visibilityList}>
          {perEventPreferences.map((preference) => (
            <VisibilityToggle
              preference={preference}
              saving={savingScope === preference.scope}
              onChange={onChange}
              key={preference.scope}
            />
          ))}
        </div>
      </details>
    ) : null}
  </div>
);

export default StreamVisibilitySettings;
