import {
  createPlannedPublicPageMetadata,
  PlannedPublicPage
} from "../planned-pages/planned-public-page";
import { sponsorsPagePlan } from "../planned-pages/planned-public-page-data";

export const metadata = createPlannedPublicPageMetadata(sponsorsPagePlan);

const SponsorsPage = (): React.ReactNode => <PlannedPublicPage definition={sponsorsPagePlan} />;

export default SponsorsPage;
