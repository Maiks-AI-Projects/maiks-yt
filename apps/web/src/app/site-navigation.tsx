"use client";

import { useState } from "react";
import { FiMenu, FiX } from "react-icons/fi";

import styles from "./site-shell.module.css";

const navigationItems = [
  { href: "/schedule", label: "Schedule" },
  { href: "/games", label: "Games" },
  { href: "/projects", label: "Projects" },
  { href: "/updates", label: "Updates" },
  { href: "/links", label: "Community" },
  { href: "/progress", label: "Build progress" },
  { href: "/about", label: "About" }
] as const;

export const SiteNavigation = (): React.ReactNode => {
  const [menuOpen, setMenuOpen] = useState<boolean>(false);

  return (
    <div className={`${styles.navigation} ${menuOpen ? styles.navigationOpen : ""}`}>
      <button
        aria-controls="primary-navigation"
        aria-expanded={menuOpen}
        aria-label={menuOpen ? "Close navigation" : "Open navigation"}
        className={styles.menuButton}
        onClick={() => setMenuOpen((current) => !current)}
        type="button"
      >
        {menuOpen ? <FiX aria-hidden="true" /> : <FiMenu aria-hidden="true" />}
      </button>
      <nav className={styles.links} id="primary-navigation" aria-label="Primary navigation">
        {navigationItems.map((item) => (
          <a href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>
        ))}
      </nav>
    </div>
  );
};
