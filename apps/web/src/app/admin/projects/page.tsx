import ProjectAdminClient from "./project-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Project Admin | Maiks.yt",
  description: "Owner-only project management for non-money project content."
};

const ProjectAdminPage = (): React.ReactNode => (
  <main className="project-admin-page">
    <ProjectAdminClient />
  </main>
);

export default ProjectAdminPage;
