import styles from "./home.module.css";
import { HomeCurrentSection } from "./home/home-current-section";
import { HomeHero } from "./home/home-hero";
import { HomePathsSection } from "./home/home-paths-section";
import { HomePrinciplesSection } from "./home/home-principles-section";

const HomePage = (): React.ReactNode => (
  <main className={styles.homePage}>
    <HomeHero />
    <HomeCurrentSection />
    <HomePathsSection />
    <HomePrinciplesSection />
  </main>
);

export default HomePage;
