import type {
  PublicUpdateDetail,
  PublicUpdateSource,
  PublicUpdateSummary
} from "@maiks-yt/domain/updates";

export interface PublicUpdateReadRepository {
  listUpdates(): Promise<readonly PublicUpdateSource[]>;
  findUpdateBySlug(slug: string): Promise<PublicUpdateSource | null>;
}

export type PublicUpdateReadOptions = {
  includeExampleRecords?: boolean;
};

export type PublicUpdateListResult = {
  ok: true;
  updates: readonly PublicUpdateSummary[];
};

export type PublicUpdateDetailResult =
  | {
    ok: true;
    update: PublicUpdateDetail;
  }
  | {
    ok: false;
    reason: "update_not_found";
  };
