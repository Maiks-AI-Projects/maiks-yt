import StreamScheduleAdminClient from "./stream-schedule-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stream Schedule Admin | Maiks.yt",
  description: "Owner-only stream schedule management."
};

const StreamScheduleAdminPage = (): React.ReactNode => (
  <main className="project-admin-page schedule-admin-page">
    <StreamScheduleAdminClient />
  </main>
);

export default StreamScheduleAdminPage;
