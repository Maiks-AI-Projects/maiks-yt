"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FiLock, FiSearch } from "react-icons/fi";

import styles from "./profile-search.module.css";

export const ProfileSearchClient = (): React.ReactNode => {
  const [query, setQuery] = useState("");
  const [searchedFor, setSearchedFor] = useState<string | null>(null);

  return (
    <>
      <form
        className={styles.searchForm}
        onSubmit={(event) => {
          event.preventDefault();
          setSearchedFor(query.trim() || "all profiles");
        }}
      >
        <label htmlFor="profile-search">Name, channel, platform identity, or verified game name</label>
        <div className={styles.searchControl}>
          <input
            id="profile-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Try Michael or MaiksMC"
            type="search"
            value={query}
          />
          <button type="submit">
            <FiSearch aria-hidden="true" />
            <span>Search</span>
          </button>
        </div>
      </form>

      <section className={styles.results} aria-labelledby="profile-results-heading">
        <div className={styles.resultHeading}>
          <div>
            <p>Mock result</p>
            <h2 id="profile-results-heading">Profiles</h2>
          </div>
          <span>
            {searchedFor ? `Static results for “${searchedFor}”` : "Two static profile examples are available in this mock"}
          </span>
        </div>

        <div className={styles.resultList}>
          <Link className={styles.resultRow} href="/profiles/michael-public">
            <span className={styles.resultPortrait}>
              <Image
                alt=""
                fill
                sizes="84px"
                src="/images/profiles/michael-profile-portrait.png"
              />
            </span>
            <span className={styles.resultIdentity}>
              <strong>Michael Public</strong>
              <span>MaiksMC · Visitor-facing profile example</span>
            </span>
            <span className={styles.resultContext}>Public identity, links, recognition, and privacy boundaries</span>
            <span className={styles.openLabel}>Open public profile</span>
          </Link>

          <Link className={styles.resultRow} href="/profiles/michael-private">
            <span className={styles.privatePortrait} aria-label="Profile image hidden">
              <FiLock aria-hidden="true" />
            </span>
            <span className={styles.resultIdentity}>
              <strong>Michael Private</strong>
              <span>This account is set to private</span>
            </span>
            <span className={styles.resultContext}>Profile image and details hidden</span>
            <span className={styles.openLabel}>Open private profile</span>
          </Link>
        </div>
      </section>
    </>
  );
};
