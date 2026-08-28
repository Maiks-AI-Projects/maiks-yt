export type SessionAdminActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};

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

export type SessionAdminListPage = {
  sessions: readonly SessionAdminRecord[];
  shownCount: number;
  hasMore: boolean;
};

export type SessionAdminListResult =
  | {
    ok: true;
  } & SessionAdminListPage
  | {
    ok: false;
    reason: "session_admin_user_unlinked" | "session_admin_forbidden";
  };

export type SessionAdminMutationResult =
  | {
    ok: true;
  }
  | {
    ok: false;
    reason:
      | "session_admin_user_unlinked"
      | "session_admin_forbidden"
      | "session_admin_invalid_input"
      | "session_admin_not_found";
  };

export interface SessionAdminRepository {
  resolveActor(authUserId: string): Promise<SessionAdminActor | null>;
  listSessions(authUserId: string, currentSessionId: string | null): Promise<SessionAdminListPage>;
  revokeSession(authUserId: string, id: string): Promise<boolean>;
  revokeOtherSessions(authUserId: string, currentSessionId: string): Promise<number>;
}
