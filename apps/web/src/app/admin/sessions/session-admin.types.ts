export type SessionAdminRecord = {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isCurrent: boolean;
  isExpired: boolean;
};

export type SessionAdminListResponse = {
  ok: true;
  sessions: readonly SessionAdminRecord[];
  shownCount: number;
  hasMore: boolean;
};
