import type { Metadata } from "next";

import { MichaelProfileMock } from "../michael-profile-mock";

export const metadata: Metadata = {
  title: "Michael's Private Profile Mock | Maiks.yt",
  description: "A static mock showing how a searchable private Maiks.yt profile limits visitor-visible information."
};

const MichaelPrivateProfileMockPage = (): React.ReactNode => <MichaelProfileMock view="private" />;

export default MichaelPrivateProfileMockPage;
