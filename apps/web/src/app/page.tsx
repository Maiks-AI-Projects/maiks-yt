import styles from "./home.module.css";
import { HomeCurrentSection } from "./home/home-current-section";
import { HomeHero } from "./home/home-hero";
import { HomePathsSection } from "./home/home-paths-section";
import { HomePrinciplesSection } from "./home/home-principles-section";
import { getHomeProjectSlot } from "./home/home-project-data";
import { getHomeScheduleSlot } from "./home/home-schedule-data";
import { getPublicProjects } from "./projects/project-read-data";
import { getPublicStreamSchedule } from "./schedule/stream-schedule-data";

const HomePage = async (): Promise<React.ReactNode> => {
  const [scheduleResult, projectResult] = await Promise.all([
    getPublicStreamSchedule(),
    getPublicProjects()
  ]);
  const scheduleSlot = getHomeScheduleSlot(scheduleResult);
  const projectSlot = getHomeProjectSlot(projectResult);

  return (
    <main className={styles.homePage}>
      <HomeHero scheduleSlot={scheduleSlot} />
      <HomeCurrentSection projectSlot={projectSlot} scheduleSlot={scheduleSlot} />
      <HomePathsSection />
      <HomePrinciplesSection />
    </main>
  );
};

export default HomePage;
