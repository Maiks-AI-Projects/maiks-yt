import {
  buildPublicUpdateDetail,
  buildPublicUpdateSummaryList
} from "@maiks-yt/domain/updates";

import type {
  PublicUpdateDetailResult,
  PublicUpdateListResult,
  PublicUpdateReadRepository
} from "./public-update-read.types.js";

export class PublicUpdateReadService {
  public constructor(private readonly repository: PublicUpdateReadRepository) {}

  public async listUpdates(): Promise<PublicUpdateListResult> {
    return {
      ok: true,
      updates: buildPublicUpdateSummaryList(await this.repository.listUpdates())
    };
  }

  public async getUpdate(slug: string): Promise<PublicUpdateDetailResult> {
    const source = await this.repository.findUpdateBySlug(slug);
    const update = source ? buildPublicUpdateDetail(source) : null;

    return update
      ? { ok: true, update }
      : { ok: false, reason: "update_not_found" };
  }
}
