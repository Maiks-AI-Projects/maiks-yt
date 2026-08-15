import {
  createPlannedPublicPageMetadata,
  PlannedPublicPage
} from "../planned-pages/planned-public-page";
import { supportPagePlan } from "../planned-pages/planned-public-page-data";

export const metadata = createPlannedPublicPageMetadata(supportPagePlan);

const SupportPage = (): React.ReactNode => <PlannedPublicPage definition={supportPagePlan} />;

export default SupportPage;
