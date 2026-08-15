import {
  createPlannedPublicPageMetadata,
  PlannedPublicPage
} from "../planned-pages/planned-public-page";
import { channelsPagePlan } from "../planned-pages/planned-public-page-data";

export const metadata = createPlannedPublicPageMetadata(channelsPagePlan);

const ChannelsPage = (): React.ReactNode => <PlannedPublicPage definition={channelsPagePlan} />;

export default ChannelsPage;
