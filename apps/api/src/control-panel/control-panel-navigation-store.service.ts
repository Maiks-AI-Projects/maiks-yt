import type { DatabasePool } from "@maiks-yt/database";

export class ControlPanelNavigationStoreService {
  public constructor(private readonly pool: DatabasePool) {}

  public async listActiveRolePermissionValues(userId: string): Promise<readonly unknown[]> {
    const [roleRows] = await this.pool.execute(
      `
        SELECT roles.permissions
        FROM user_roles
        INNER JOIN roles ON roles.id = user_roles.role_id
        WHERE user_roles.user_id = ?
          AND user_roles.revoked_at IS NULL
          AND (user_roles.expires_at IS NULL OR user_roles.expires_at > NOW())
        ORDER BY roles.key
      `,
      [userId]
    );

    return Array.isArray(roleRows)
      ? roleRows.map((row) => (row as { permissions: unknown }).permissions)
      : [];
  }
}
