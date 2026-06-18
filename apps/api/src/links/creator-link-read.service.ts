import { buildPublicCreatorLinkList } from "@maiks-yt/domain";

import type {
  CreatorLinkListResult,
  CreatorLinkReadRepository
} from "./creator-link-read.types.js";

export class CreatorLinkReadService {
  public constructor(private readonly repository: CreatorLinkReadRepository) {}

  public async listLinks(): Promise<CreatorLinkListResult> {
    const links = await this.repository.listPublishedLinks();

    return {
      ok: true,
      links: buildPublicCreatorLinkList(links)
    };
  }
}
