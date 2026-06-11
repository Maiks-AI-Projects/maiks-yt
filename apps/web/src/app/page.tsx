import type { Project } from "@maiks-yt/domain";

const starterProject: Project = {
  id: "maiks-yt-v2",
  title: "Maiks.yt V2",
  type: "stream-work-project",
  category: "software-project",
  status: "active",
  items: [],
  milestones: [
    {
      id: "foundation",
      title: "Build the typed foundation",
      status: "active"
    }
  ]
};

const HomePage = (): React.ReactNode => (
  <main>
    <h1>Maiks.yt V2</h1>
    <p>Planning baseline has moved into a TypeScript monorepo scaffold.</p>
    <section>
      <h2>Active Project</h2>
      <p>{starterProject.title}</p>
      <p>Milestone: {starterProject.milestones[0]?.title}</p>
    </section>
  </main>
);

export default HomePage;
