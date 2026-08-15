import {
  createPlannedPublicPageMetadata,
  PlannedPublicPage
} from "../planned-pages/planned-public-page";
import { interactionsPagePlan } from "../planned-pages/planned-public-page-data";

export const metadata = createPlannedPublicPageMetadata(interactionsPagePlan);

const InteractionsPage = (): React.ReactNode => (
  <PlannedPublicPage definition={interactionsPagePlan} />
);

export default InteractionsPage;
