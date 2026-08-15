import {
  createPlannedPublicPageMetadata,
  PlannedPublicPage
} from "../planned-pages/planned-public-page";
import { languagesPagePlan } from "../planned-pages/planned-public-page-data";

export const metadata = createPlannedPublicPageMetadata(languagesPagePlan);

const LanguagesPage = (): React.ReactNode => <PlannedPublicPage definition={languagesPagePlan} />;

export default LanguagesPage;
