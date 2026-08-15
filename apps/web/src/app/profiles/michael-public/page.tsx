import type { Metadata } from "next";

import { MichaelProfileMock } from "../michael-profile-mock";

export const metadata: Metadata = {
  title: "Michael's Public Profile Mock | Maiks.yt",
  description: "A static public-view mock covering the planned Maiks.yt profile, identity, and recognition features."
};

const MichaelPublicProfileMockPage = (): React.ReactNode => <MichaelProfileMock view="public" />;

export default MichaelPublicProfileMockPage;
