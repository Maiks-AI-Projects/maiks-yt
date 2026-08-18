export type SessionAdminRecord = {
  id: string;
  authUserId: string;
  userName: string;
  userEmail: string;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  isCurrent: boolean;
  isExpired: boolean;
};
