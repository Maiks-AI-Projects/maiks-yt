import styles from "./home.module.css";
import { HomeCurrentSection } from "./home/home-current-section";
import { HomeHero } from "./home/home-hero";
import { HomePathsSection } from "./home/home-paths-section";
import { HomePrinciplesSection } from "./home/home-principles-section";
import { getHomeScheduleSlot } from "./home/home-schedule-data";
import { getPublicStreamSchedule } from "./schedule/stream-schedule-data";

const HomePage = async (): Promise<React.ReactNode> => {
  const scheduleSlot = getHomeScheduleSlot(await getPublicStreamSchedule());

  return (
    <main className={styles.homePage}>
      <HomeHero scheduleSlot={scheduleSlot} />
      <HomeCurrentSection scheduleSlot={scheduleSlot} />
      <HomePathsSection />
      <HomePrinciplesSection />
    </main>
  );
};

export default HomePage;
