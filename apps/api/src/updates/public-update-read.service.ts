import {
  buildPublicUpdateDetail,
  buildPublicUpdateSummaryList
} from "@maiks-yt/domain/updates";

import type {
  PublicUpdateDetailResult,
  PublicUpdateListResult,
  PublicUpdateReadOptions,
  PublicUpdateReadRepository
} from "./public-update-read.types.js";

export class PublicUpdateReadService {
  public constructor(private readonly repository: PublicUpdateReadRepository) {}

  public async listUpdates(options: PublicUpdateReadOptions = {}): Promise<PublicUpdateListResult> {
    const updates = await this.repository.listUpdates();

    return {
      ok: true,
      updates: buildPublicUpdateSummaryList(options.includeExampleRecords
        ? updates
        : updates.filter((update) => !update.isExample))
    };
  }

  public async getUpdate(
    slug: string,
    options: PublicUpdateReadOptions = {}
  ): Promise<PublicUpdateDetailResult> {
    const source = await this.repository.findUpdateBySlug(slug);
    const update = source && (options.includeExampleRecords || !source.isExample)
      ? buildPublicUpdateDetail(source)
      : null;

    return update
      ? { ok: true, update }
      : { ok: false, reason: "update_not_found" };
  }
}
