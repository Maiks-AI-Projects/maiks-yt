"use client";

import { profileVisibilityOptions } from "./account-settings-data";
import styles from "./account.module.css";
import type { ProfileVisibility } from "./account.types";

type ProfilePrivacySettingsProps = {
  currentValue: ProfileVisibility;
  saving: boolean;
  onChange: (value: ProfileVisibility) => void;
};

const ProfilePrivacySettings = ({ currentValue, saving, onChange }: ProfilePrivacySettingsProps): React.ReactNode => (
  <div className={styles.choiceList} role="radiogroup" aria-label="Profile visibility">
    {profileVisibilityOptions.map((option) => {
      const isSelected = currentValue === option.value;

      return (
        <button
          type="button"
          className={isSelected ? `${styles.choice} ${styles.choiceSelected}` : styles.choice}
          key={option.value}
          onClick={() => onChange(option.value)}
          disabled={saving || isSelected}
          role="radio"
          aria-checked={isSelected}
        >
          <span className={styles.choiceIndicator} aria-hidden="true" />
          <span>
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </span>
        </button>
      );
    })}
  </div>
);

export default ProfilePrivacySettings;
