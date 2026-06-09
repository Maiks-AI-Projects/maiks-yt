export type ProjectItemKind = "product" | "service" | "subscription" | "task" | "wishlist" | "other";

export type ProjectItemStatus = "planned" | "active" | "acquired" | "completed" | "removed";

export type ProjectItemLinkRelationship = "store-product" | "wishlist-entry" | "reference" | "receipt";

export type MoneyEstimate = {
  minorAmount: number;
  currencyCode: string;
};

export type ProjectItemLink = {
  id: string;
  provider: string;
  url: string;
  label: string;
  relationship: ProjectItemLinkRelationship;
  lastSeenEstimate?: MoneyEstimate;
};

export type ProjectItem = {
  id: string;
  projectId: string;
  parentItemId?: string;
  title: string;
  kind: ProjectItemKind;
  status: ProjectItemStatus;
  quantity: number;
  estimate?: MoneyEstimate;
  links: readonly ProjectItemLink[];
  children: readonly ProjectItem[];
};
