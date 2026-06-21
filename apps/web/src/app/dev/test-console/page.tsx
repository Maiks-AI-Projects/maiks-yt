import { notFound } from "next/navigation";

import DevTestConsoleClient from "./test-console-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Dev Test Console | Maiks.yt",
  description: "Dev-only simulated platform event preview console."
};

const DevTestConsolePage = (): React.ReactNode => {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <main className="project-admin-page dev-test-console-page">
      <DevTestConsoleClient />
    </main>
  );
};

export default DevTestConsolePage;
