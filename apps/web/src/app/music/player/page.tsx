import type { Metadata } from "next";

import MusicPlayerClient from "./music-player-client";

export const metadata: Metadata = {
  title: "Music Player"
};

const MusicPlayerPage = (): React.ReactNode => (
  <MusicPlayerClient />
);

export default MusicPlayerPage;
