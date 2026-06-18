import type {
  CreatorLinkSource,
  PublicCreatorLink
} from "@maiks-yt/domain";

export interface CreatorLinkReadRepository {
  listPublishedLinks(): Promise<readonly CreatorLinkSource[]>;
}

export type CreatorLinkListResult = {
  ok: true;
  links: readonly PublicCreatorLink[];
};
