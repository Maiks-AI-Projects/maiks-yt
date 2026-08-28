import styles from "./about.module.css";

type AboutRoute = "about" | "ai" | "health" | "history";

const aboutRoutes = [
  { href: "/about", id: "about", label: "Who I am" },
  { href: "/about/ai", id: "ai", label: "AI and my work" },
  { href: "/about/health", id: "health", label: "Medical history" },
  { href: "/about/history", id: "history", label: "My history" }
] as const;

type AboutNavigationProps = {
  current: AboutRoute;
};

export const AboutNavigation = ({ current }: AboutNavigationProps): React.ReactNode => (
  <nav className={styles.aboutNavigation} aria-label="About Michael">
    {aboutRoutes.map((route) => (
      <a aria-current={route.id === current ? "page" : undefined} href={route.href} key={route.id}>
        {route.label}
      </a>
    ))}
  </nav>
);
