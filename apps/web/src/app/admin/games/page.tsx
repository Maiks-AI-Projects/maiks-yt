import GameLibraryAdminClient from "./game-library-admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Game Library | Maiks.yt",
  description: "Owner-only game library management."
};

const GameLibraryAdminPage = (): React.ReactNode => (
  <main className="project-admin-page game-library-admin-page">
    <GameLibraryAdminClient />
  </main>
);

export default GameLibraryAdminPage;
