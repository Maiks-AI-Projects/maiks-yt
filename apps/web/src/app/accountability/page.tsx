import type { Metadata } from "next";

import { getPublicProjectSummaryKey } from "../projects/project-public-keys.rules";
import { getPublicProjects } from "../projects/project-read-data";
import styles from "./accountability.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Accountability record",
  description: "Public Maiks.yt project outcomes, corrections, and material changes."
};

const recordPrinciples = [
  {
    title: "Plans stay labelled as plans",
    description: "Unfinished work is not presented as a completed result."
  },
  {
    title: "Material changes keep a date",
    description: "A changed direction should leave enough context to understand when and why."
  },
  {
    title: "Corrections do not erase history",
    description: "The correction should sit beside the original public claim or record."
  },
  {
    title: "Other people's privacy remains intact",
    description: "Accountability does not require exposing unrelated private people or details."
  }
] as const;

const AccountabilityPage = async (): Promise<React.ReactNode> => {
  const projectResult = await getPublicProjects();
  const completedProjects = projectResult.status === "loaded"
    ? projectResult.projects.filter((project) => project.status === "completed")
    : [];

  return (
    <main className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Public accountability record</p>
        <h1>Plans change. The record stays.</h1>
        <p>
          This page is the public index for material project outcomes, corrections, and changed
          claims around Maiks.yt. Published records stay available so later changes do not erase
          what was previously said or planned.
        </p>
      </header>

      <aside className={styles.statusNotice} aria-label="Accountability system status">
        <p className={styles.sectionLabel}>System status</p>
        <strong>This accountability system is still being built.</strong>
        <p>
          Completed public projects can already appear from the live project records. Dedicated
          correction entries, archived outcomes, and public financial reporting are not connected
          yet. One or more ongoing court cases also need to conclude before this system can be used
          as intended; no case details or conclusions are published here while those matters remain
          ongoing.
        </p>
      </aside>

      <section className={styles.principles} aria-label="Accountability principles">
        <ol className={styles.principleList}>
          {recordPrinciples.map((principle, index) => (
            <li key={principle.title}>
              <span className={styles.principleNumber}>{String(index + 1).padStart(2, "0")}</span>
              <strong>{principle.title}</strong>
              <p>{principle.description}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.records} aria-labelledby="outcomes-heading">
        <header className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionLabel}>Project record</p>
            <h2 id="outcomes-heading">Published outcomes</h2>
          </div>
          <p>
            Completed public projects appear here from the same live project records used by the
            rest of the website. Active and planned work remains on the projects page.
          </p>
        </header>

        {projectResult.status === "error" ? (
          <div className={styles.emptyState} aria-live="polite">
            <strong>Project outcomes are temporarily unavailable.</strong>
            <p>Please try again shortly.</p>
          </div>
        ) : completedProjects.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No completed public project outcomes yet.</strong>
            <p>Current work is still active or in planning. This state will change when a public project is completed.</p>
            <a href="/projects">Open current projects &rarr;</a>
          </div>
        ) : (
          <div className={styles.recordList}>
            {completedProjects.map((project) => (
              <article className={styles.recordRow} key={getPublicProjectSummaryKey(project)}>
                <div className={styles.recordIdentity}>
                  <p className={styles.recordStatus}>Completed project</p>
                  <h3><a href={`/projects/${project.slug}`}>{project.title}</a></h3>
                </div>
                <p>{project.summary}</p>
                <a className={styles.textLink} href={`/projects/${project.slug}`}>Read the outcome &rarr;</a>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className={styles.records} aria-labelledby="corrections-heading">
        <header className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionLabel}>Corrections</p>
            <h2 id="corrections-heading">Material changes and corrections</h2>
          </div>
          <p>
            A future correction record will identify the original statement, explain what changed,
            and retain the date. Ordinary wording edits do not need to become public incidents.
          </p>
        </header>
        <div className={styles.emptyState}>
          <strong>No material corrections have been published.</strong>
          <p>Project updates and announcements remain available in the public update archive.</p>
          <a href="/updates">Open public updates &rarr;</a>
        </div>
      </section>

    </main>
  );
};

export default AccountabilityPage;
