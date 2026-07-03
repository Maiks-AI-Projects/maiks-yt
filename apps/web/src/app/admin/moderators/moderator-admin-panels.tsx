import {
  grantableModeratorTrustLevels,
  moderatorGrantAvailabilities,
  moderatorGrantScopeKinds
} from "@maiks-yt/domain/community";
import type {
  GrantableModeratorTrustLevel,
  ModeratorGrantAvailability,
  ModeratorGrantScopeKind
} from "@maiks-yt/domain/community";
import type { Dispatch, FormEvent, SetStateAction } from "react";

import {
  actionLabels,
  availabilityLabels,
  formatDate,
  getRankPathLabel,
  getUserLabel,
  scopeLabels,
  trustLevelLabels,
  type GrantFormState,
  type ModeratorAdminAuditLog,
  type ModeratorAdminGrant,
  type ModeratorAdminRankPath,
  type ModeratorAdminRole,
  type ModeratorAdminUser,
  type RankPathFormState,
  type RoleFormState
} from "./moderator-admin-client.service";

type UsersSidebarProps = {
  users: readonly ModeratorAdminUser[];
  selectedUserId: string;
  onSelectUser: (userId: string) => void;
};

export const UsersSidebar = ({
  users,
  selectedUserId,
  onSelectUser
}: UsersSidebarProps): React.ReactNode => (
  <aside className="project-admin-sidebar" aria-label="Users">
    <div className="project-admin-sidebar-heading">
      <h2>Users</h2>
      <span>{users.length}</span>
    </div>
    <div className="project-admin-selector">
      {users.map((user) => (
        <button
          key={user.id}
          type="button"
          className={user.id === selectedUserId ? "selected" : ""}
          onClick={() => onSelectUser(user.id)}
        >
          <strong>{user.displayName}</strong>
          <span>{user.authEmail ?? user.profileVisibility}</span>
        </button>
      ))}
    </div>
  </aside>
);

type GrantsPanelProps = {
  users: readonly ModeratorAdminUser[];
  selectedUserId: string;
  grants: readonly ModeratorAdminGrant[];
  busy: boolean;
  onNewGrant: () => void;
  onEditGrant: (grant: ModeratorAdminGrant) => void;
  onRevokeGrant: (grant: ModeratorAdminGrant) => void;
};

export const GrantsPanel = ({
  users,
  selectedUserId,
  grants,
  busy,
  onNewGrant,
  onEditGrant,
  onRevokeGrant
}: GrantsPanelProps): React.ReactNode => (
  <section className="project-admin-panel visibility-panel">
    <div className="project-admin-panel-heading">
      <div>
        <h2>{getUserLabel(users, selectedUserId)}</h2>
        <p>Current helper and moderator grants.</p>
      </div>
      <div className="project-admin-actions">
        <button type="button" onClick={onNewGrant} disabled={busy}>New grant</button>
      </div>
    </div>

    {grants.length === 0 ? (
      <p className="project-admin-note">No role grants for this user.</p>
    ) : (
      <ul className="project-admin-record-list">
        {grants.map((grant) => (
          <li key={grant.id}>
            <div>
              <strong>{grant.roleName}</strong>
              <p>
                {trustLevelLabels[grant.trustLevel]} · {scopeLabels[grant.scopeKind]}
                {grant.scopeId ? ` / ${grant.scopeId}` : ""} · {availabilityLabels[grant.availability]}
              </p>
              <p>Status: {grant.status}. Expires: {formatDate(grant.expiresAt)}.</p>
            </div>
            <div className="project-admin-actions">
              <button type="button" onClick={() => onEditGrant(grant)} disabled={busy || grant.status === "revoked"}>Edit</button>
              <button type="button" onClick={() => onRevokeGrant(grant)} disabled={busy || grant.status === "revoked"}>Revoke</button>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

type GrantFormPanelProps = {
  users: readonly ModeratorAdminUser[];
  grantableRoles: readonly ModeratorAdminRole[];
  selectedGrant: ModeratorAdminGrant | null;
  editingGrantId: string | null;
  form: GrantFormState;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancelEdit: () => void;
  setForm: Dispatch<SetStateAction<GrantFormState>>;
};

export const GrantFormPanel = ({
  users,
  grantableRoles,
  selectedGrant,
  editingGrantId,
  form,
  busy,
  onSubmit,
  onCancelEdit,
  setForm
}: GrantFormPanelProps): React.ReactNode => (
  <form className="project-admin-panel project-admin-form moderator-admin-form" onSubmit={onSubmit}>
    <div className="project-admin-panel-heading">
      <div>
        <h2>{editingGrantId ? "Edit Grant" : "Grant Role"}</h2>
        <p>{selectedGrant ? `${selectedGrant.roleName} for ${getUserLabel(users, selectedGrant.userId)}` : "Manual helper/moderator access."}</p>
      </div>
    </div>

    <div className="project-admin-form-grid">
      <label>
        User
        <select value={form.targetUserId} onChange={(event) => setForm((current) => ({ ...current, targetUserId: event.target.value }))} disabled={Boolean(editingGrantId)}>
          {users.map((user) => (
            <option key={user.id} value={user.id}>{user.displayName}</option>
          ))}
        </select>
      </label>

      <label>
        Role
        <select value={form.roleId} onChange={(event) => setForm((current) => ({ ...current, roleId: event.target.value }))} disabled={Boolean(editingGrantId)}>
          {grantableRoles.length === 0 ? (
            <option value="">No grantable roles</option>
          ) : grantableRoles.map((role) => (
            <option key={role.id} value={role.id}>{role.name} ({role.key})</option>
          ))}
        </select>
      </label>

      <label>
        Trust level
        <select value={form.trustLevel} onChange={(event) => setForm((current) => ({ ...current, trustLevel: event.target.value as GrantableModeratorTrustLevel }))}>
          {grantableModeratorTrustLevels.map((trustLevel) => (
            <option key={trustLevel} value={trustLevel}>{trustLevelLabels[trustLevel]}</option>
          ))}
        </select>
      </label>

      <label>
        Scope
        <select value={form.scopeKind} onChange={(event) => setForm((current) => ({ ...current, scopeKind: event.target.value as ModeratorGrantScopeKind, scopeId: "" }))}>
          {moderatorGrantScopeKinds.map((scopeKind) => (
            <option key={scopeKind} value={scopeKind}>{scopeLabels[scopeKind]}</option>
          ))}
        </select>
      </label>

      <label>
        Scope ID
        <input value={form.scopeId} onChange={(event) => setForm((current) => ({ ...current, scopeId: event.target.value }))} disabled={form.scopeKind === "global"} maxLength={191} />
      </label>

      <label>
        Availability
        <select value={form.availability} onChange={(event) => setForm((current) => ({ ...current, availability: event.target.value as ModeratorGrantAvailability }))}>
          {moderatorGrantAvailabilities.map((availability) => (
            <option key={availability} value={availability}>{availabilityLabels[availability]}</option>
          ))}
        </select>
      </label>

      <label>
        Expires
        <input type="datetime-local" value={form.expiresAt} onChange={(event) => setForm((current) => ({ ...current, expiresAt: event.target.value }))} />
      </label>

      <label>
        Reason
        <input value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} maxLength={280} />
      </label>
    </div>

    <div className="project-admin-actions">
      <button type="submit" disabled={busy || grantableRoles.length === 0}>{editingGrantId ? "Save grant" : "Grant role"}</button>
      {editingGrantId ? <button type="button" onClick={onCancelEdit} disabled={busy}>Cancel edit</button> : null}
    </div>
  </form>
);

type RankPathsPanelProps = {
  rankPaths: readonly ModeratorAdminRankPath[];
  form: RankPathFormState;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNewPath: () => void;
  setForm: Dispatch<SetStateAction<RankPathFormState>>;
};

export const RankPathsPanel = ({
  rankPaths,
  form,
  busy,
  onSubmit,
  onNewPath,
  setForm
}: RankPathsPanelProps): React.ReactNode => (
  <section className="project-admin-panel project-admin-form">
    <div className="project-admin-panel-heading">
      <div>
        <h2>Rank Paths</h2>
        <p>Owner-only role paths and promotion lanes.</p>
      </div>
      <div className="project-admin-actions">
        <button type="button" onClick={onNewPath} disabled={busy}>New path</button>
      </div>
    </div>

    <form className="project-admin-form-grid" onSubmit={onSubmit}>
      <label>
        Key
        <input value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} maxLength={80} />
      </label>
      <label>
        Name
        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={191} />
      </label>
      <label>
        Sort
        <input type="number" min={0} value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
      </label>
      <label>
        Description
        <input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} maxLength={280} />
      </label>
      <div className="project-admin-actions">
        <button type="submit" disabled={busy}>{form.id ? "Save path" : "Create path"}</button>
      </div>
    </form>

    <ul className="project-admin-record-list">
      {rankPaths.map((rankPath) => (
        <li key={rankPath.id}>
          <div>
            <strong>{rankPath.name}</strong>
            <p>{rankPath.key} · sort {rankPath.sortOrder}</p>
            <p>{rankPath.description ?? "No description"}</p>
          </div>
          <div className="project-admin-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => setForm({
                id: rankPath.id,
                key: rankPath.key,
                name: rankPath.name,
                description: rankPath.description ?? "",
                sortOrder: String(rankPath.sortOrder)
              })}
            >
              Edit
            </button>
          </div>
        </li>
      ))}
    </ul>
  </section>
);

type RoleRightsPanelProps = {
  rankPaths: readonly ModeratorAdminRankPath[];
  roles: readonly ModeratorAdminRole[];
  form: RoleFormState;
  busy: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onNewRole: () => void;
  setForm: Dispatch<SetStateAction<RoleFormState>>;
};

export const RoleRightsPanel = ({
  rankPaths,
  roles,
  form,
  busy,
  onSubmit,
  onNewRole,
  setForm
}: RoleRightsPanelProps): React.ReactNode => (
  <section className="project-admin-panel project-admin-form">
    <div className="project-admin-panel-heading">
      <div>
        <h2>Role Rights</h2>
        <p>Owner-only action rights collected by ranks.</p>
      </div>
      <div className="project-admin-actions">
        <button type="button" onClick={onNewRole} disabled={busy}>New role</button>
      </div>
    </div>

    <form className="project-admin-form-grid" onSubmit={onSubmit}>
      <label>
        Key
        <input value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} maxLength={80} />
      </label>
      <label>
        Name
        <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} maxLength={191} />
      </label>
      <label>
        Rank path
        <select value={form.rankPathId} onChange={(event) => setForm((current) => ({ ...current, rankPathId: event.target.value }))}>
          <option value="">No path</option>
          {rankPaths.map((rankPath) => (
            <option key={rankPath.id} value={rankPath.id}>{rankPath.name}</option>
          ))}
        </select>
      </label>
      <label>
        Level
        <input type="number" min={1} value={form.rankLevel} onChange={(event) => setForm((current) => ({ ...current, rankLevel: event.target.value }))} />
      </label>
      <label>
        Display label
        <input value={form.displayLabel} onChange={(event) => setForm((current) => ({ ...current, displayLabel: event.target.value }))} maxLength={191} />
      </label>
      <label>
        Next promotion
        <select value={form.nextRoleId} onChange={(event) => setForm((current) => ({ ...current, nextRoleId: event.target.value }))}>
          <option value="">None</option>
          {roles.map((role) => (
            <option key={role.id} value={role.id}>{role.name}</option>
          ))}
        </select>
      </label>
      <label>
        Discord role ID
        <input value={form.discordRoleId} onChange={(event) => setForm((current) => ({ ...current, discordRoleId: event.target.value }))} maxLength={80} />
      </label>
      <label>
        Permissions
        <textarea value={form.permissions} onChange={(event) => setForm((current) => ({ ...current, permissions: event.target.value }))} rows={4} />
      </label>
      <label className="project-admin-checkbox">
        <input type="checkbox" checked={form.isOwnerRank} onChange={(event) => setForm((current) => ({ ...current, isOwnerRank: event.target.checked }))} />
        Owner rank
      </label>
      <label className="project-admin-checkbox">
        <input type="checkbox" checked={form.isSystem} onChange={(event) => setForm((current) => ({ ...current, isSystem: event.target.checked }))} />
        System/default rank
      </label>
      <div className="project-admin-actions">
        <button type="submit" disabled={busy}>{form.id ? "Save role" : "Create role"}</button>
      </div>
    </form>
  </section>
);

type RolesPanelProps = {
  rankPaths: readonly ModeratorAdminRankPath[];
  roles: readonly ModeratorAdminRole[];
  busy: boolean;
  canManageRanks: boolean;
  setRoleForm: Dispatch<SetStateAction<RoleFormState>>;
};

export const RolesPanel = ({
  rankPaths,
  roles,
  busy,
  canManageRanks,
  setRoleForm
}: RolesPanelProps): React.ReactNode => (
  <section className="project-admin-panel">
    <div className="project-admin-panel-heading">
      <div>
        <h2>Roles</h2>
        <p>Grantable roles exclude owner-only and dangerous capabilities.</p>
      </div>
    </div>
    <ul className="project-admin-record-list">
      {roles.map((role) => (
        <li key={role.id}>
          <div>
            <strong>{role.name}</strong>
            <p>
              {role.key} · {getRankPathLabel(rankPaths, role.rankPathId)}
              {role.rankLevel ? ` lvl ${role.rankLevel}` : ""} · {role.grantable ? "Grantable" : "Protected"}
            </p>
            <p>{role.displayLabel ? `Display: ${role.displayLabel}. ` : ""}{role.discordRoleId ? `Discord: ${role.discordRoleId}. ` : ""}{role.nextRoleId ? `Next: ${roles.find((candidate) => candidate.id === role.nextRoleId)?.name ?? role.nextRoleId}.` : ""}</p>
            <p>{role.permissions.length > 0 ? role.permissions.join(", ") : "No permissions"}</p>
          </div>
          {canManageRanks ? (
            <div className="project-admin-actions">
              <button
                type="button"
                disabled={busy}
                onClick={() => setRoleForm({
                  id: role.id,
                  key: role.key,
                  name: role.name,
                  permissions: role.permissions.join("\n"),
                  rankPathId: role.rankPathId ?? "",
                  rankLevel: role.rankLevel === null ? "" : String(role.rankLevel),
                  displayLabel: role.displayLabel ?? "",
                  nextRoleId: role.nextRoleId ?? "",
                  discordRoleId: role.discordRoleId ?? "",
                  isOwnerRank: role.isOwnerRank,
                  isSystem: role.isSystem
                })}
              >
                Edit
              </button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  </section>
);

type AuditPanelProps = {
  auditLogs: readonly ModeratorAdminAuditLog[];
};

export const AuditPanel = ({ auditLogs }: AuditPanelProps): React.ReactNode => (
  <section className="project-admin-panel">
    <div className="project-admin-panel-heading">
      <div>
        <h2>Recent Audit</h2>
        <p>Role grant changes from newest to oldest.</p>
      </div>
    </div>
    {auditLogs.length === 0 ? (
      <p className="project-admin-note">No role grant audit entries yet.</p>
    ) : (
      <ul className="project-admin-record-list">
        {auditLogs.map((log) => (
          <li key={log.id}>
            <div>
              <strong>{actionLabels[log.action]} {log.roleName ?? log.roleId}</strong>
              <p>{log.targetDisplayName ?? log.targetUserId} by {log.actorDisplayName ?? log.actorUserId ?? "system"} · {formatDate(log.createdAt)}</p>
              <p>{log.reason ?? "No reason recorded"}</p>
            </div>
          </li>
        ))}
      </ul>
    )}
  </section>
);

export const OwnerOnlyNote = (): React.ReactNode => (
  <section className="project-admin-panel project-admin-note">
    <h2>Owner-only</h2>
    <p>Owner/admin assignment, production auth and secrets, provider credentials, real money authority, irreversible user deletion, role-management permission, and audit log disabling stay unavailable from this page.</p>
  </section>
);
