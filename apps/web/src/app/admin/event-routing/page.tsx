import EventRoutingAdminClient from "./event-routing-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Event Routing Admin | Maiks.yt",
  description: "Owner-only manual event routing rules."
};

const EventRoutingAdminPage = (): React.ReactNode => (
  <main className="project-admin-page event-routing-admin-page">
    <EventRoutingAdminClient />
  </main>
);

export default EventRoutingAdminPage;
