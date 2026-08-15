"use client";

import type { StreamVisibilityPreferenceScope } from "@maiks-yt/domain/events";
import * as Switch from "@radix-ui/react-switch";

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

const VisibilityToggle = ({ preference, saving, onChange }: VisibilityToggleProps): React.ReactNode => (
  <div className={styles.visibilityRow}>
    <div>
      <strong>{preference.label}</strong>
      <span>{preference.description}</span>
    </div>
    <div className={styles.switchGroup}>
      <AccountControlTooltip text={`Turn this on to keep ${preference.label.toLowerCase()} off stream.`}>
        <span className={styles.tooltipTrigger}>
          <Switch.Root
            className={styles.switch}
            checked={preference.optedOut}
            disabled={saving}
            onCheckedChange={(checked) => onChange(preference.scope, checked)}
            aria-label={`Keep ${preference.label} off stream`}
          >
            <Switch.Thumb className={styles.switchThumb} />
          </Switch.Root>
        </span>
      </AccountControlTooltip>
      <span>{saving ? "Saving" : preference.optedOut ? "Hidden" : "Allowed"}</span>
    </div>
  </div>
);

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
