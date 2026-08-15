import styles from "../home.module.css";

const principles = [
  ["Open by default", "Watch streams, follow projects, and read updates without being forced to create an account."],
  ["Human control", "Automation and AI can assist, but important public, moderation, and money decisions remain reviewable."],
  ["Visible progress", "Plans, active work, blockers, and completed work are presented as different states."],
  ["Privacy respected", "Public participation and private account information stay deliberately separated."]
] as const;

export const HomePrinciplesSection = (): React.ReactNode => (
  <section className={styles.band} aria-labelledby="home-principles-title">
    <div className={`${styles.bandInner} ${styles.principlesGrid}`}>
      <div>
        <p className={styles.eyebrow}>How this place works</p>
        <h2 id="home-principles-title">Built for people, not engagement tricks.</h2>
      </div>
      <ul className={styles.principleList}>
        {principles.map(([title, description]) => (
          <li key={title}>
            <strong>{title}</strong>
            <span>{description}</span>
          </li>
        ))}
      </ul>
    </div>
  </section>
);
