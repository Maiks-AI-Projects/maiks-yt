import {
  createPlannedPublicPageMetadata,
  PlannedPublicPage
} from "../planned-pages/planned-public-page";
import { musicPagePlan } from "../planned-pages/planned-public-page-data";

export const metadata = createPlannedPublicPageMetadata(musicPagePlan);

const MusicPage = (): React.ReactNode => <PlannedPublicPage compact definition={musicPagePlan} />;

export default MusicPage;
