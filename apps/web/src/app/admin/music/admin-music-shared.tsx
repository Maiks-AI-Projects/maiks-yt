"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import styles from "../../music/music.module.css";
import type { MusicAdminLoadState } from "./admin-music-data.service";

const musicAdminItems = [
  { href: "/admin/music", label: "Overview" },
  { href: "/admin/music/catalog", label: "Catalog" },
  { href: "/admin/music/import", label: "Import" },
  { href: "/admin/music/playlists", label: "Playlists" },
  { href: "/admin/music/review", label: "Review" },
  { href: "/admin/music/history", label: "History" }
] as const;

export const MusicAdminSubnav = (): React.ReactNode => {
  const pathname = usePathname();

  return (
    <nav className={styles.localSubnav} aria-label="Music admin sections">
      {musicAdminItems.map((item) => (
        <Link
          aria-current={pathname === item.href ? "page" : undefined}
          href={item.href}
          key={item.href}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
};

export const MusicAdminHeader = ({ description, title }: {
  readonly description: string;
  readonly title: string;
}): React.ReactNode => (
  <>
    <header className="project-admin-header">
      <p className={styles.eyebrow}>Music operations</p>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
    <MusicAdminSubnav />
  </>
);

export const MusicAdminStatus = ({ countLabel, loadState, message, onRefresh }: {
  readonly countLabel: string;
  readonly loadState: MusicAdminLoadState;
  readonly message: string;
  readonly onRefresh: () => void;
}): React.ReactNode => (
  <section className={styles.surface}>
    <div className={styles.sectionHeader}>
      <div>
        <h2>Status</h2>
        <p>{message}</p>
      </div>
      <button className={styles.textButton} onClick={onRefresh} type="button">Refresh</button>
    </div>
    <div className={styles.compactGrid}>
      <span className={styles.badge}>{loadState}</span>
      <span className={styles.badge}>{countLabel}</span>
    </div>
  </section>
);

export type FieldProps = {
  readonly defaultValue?: string | undefined;
  readonly disabled?: boolean;
  readonly label: string;
  readonly name: string;
  readonly placeholder?: string;
  readonly required?: boolean;
  readonly type?: "number" | "text";
};

export const TextField = ({ defaultValue, disabled = false, label, name, placeholder, required = false, type = "text" }: FieldProps): React.ReactNode => (
  <label>
    <span>{label}</span>
    <input defaultValue={defaultValue} disabled={disabled} name={name} placeholder={placeholder} required={required} type={type} />
  </label>
);

export const SelectField = ({ defaultValue, label, name, options }: {
  readonly defaultValue?: string | undefined;
  readonly label: string;
  readonly name: string;
  readonly options: readonly string[];
}): React.ReactNode => (
  <label>
    <span>{label}</span>
    <select defaultValue={defaultValue} name={name}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  </label>
);

export const CheckboxField = ({ defaultChecked = false, label, name }: {
  readonly defaultChecked?: boolean;
  readonly label: string;
  readonly name: string;
}): React.ReactNode => (
  <label className={styles.checkboxField}>
    <input defaultChecked={defaultChecked} name={name} type="checkbox" />
    <span>{label}</span>
  </label>
);

export const CompactRows = ({ emptyLabel, rows }: {
  readonly emptyLabel: string;
  readonly rows: readonly {
    readonly action: string;
    readonly meta: string;
    readonly state: string;
    readonly title: string;
  }[];
}): React.ReactNode => {
  if (rows.length === 0) {
    return <p className={styles.emptyState}>{emptyLabel}</p>;
  }

  return (
    <div className={styles.tableGrid}>
      <div className={`${styles.tableRow} ${styles.tableRowHeader}`}>
        <span>Name</span>
        <span>Context</span>
        <span>State</span>
        <span>Action</span>
      </div>
      {rows.map((row) => (
        <div className={styles.tableRow} key={`${row.title}:${row.meta}:${row.state}:${row.action}`}>
          <span className={styles.rowTitle}>
            <strong>{row.title}</strong>
            <span>{row.meta}</span>
          </span>
          <span className={styles.rowMeta}>{row.meta}</span>
          <span className={styles.rowMeta}>{row.state}</span>
          <span className={styles.rowMeta}>{row.action}</span>
        </div>
      ))}
    </div>
  );
};
