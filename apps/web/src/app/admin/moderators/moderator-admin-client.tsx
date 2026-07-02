"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  grantableModeratorTrustLevels,
  moderatorGrantAvailabilities,
  moderatorGrantScopeKinds,
  type GrantableModeratorTrustLevel,
  type ModeratorGrantAvailability,
  type ModeratorGrantScopeKind,
  type ModeratorTrustLevel,
  type RoleGrantAuditAction
} from "@maiks-yt/domain/community";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";

type ModeratorAdminUser = {
  id: string;
  displayName: string;
  profileVisibility: string;
  avatarUrl: string | null;
  authEmail: string | null;
  createdAt: string;
  updatedAt: string;
};

type ModeratorAdminRole = {
  id: string;
  key: string;
  name: string;
  permissions: readonly string[];
  rankPathId: string | null;
  rankPathKey: string | null;
  rankPathName: string | null;
  rankLevel: number | null;
  displayLabel: string | null;
  nextRoleId: string | null;
  discordRoleId: string | null;
  isOwnerRank: boolean;
  isSystem: boolean;
  grantable: boolean;
  createdAt: string;
  updatedAt: string;
};

type ModeratorAdminRankPath = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type ModeratorAdminGrant = {
  id: string;
  userId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
  rolePermissions: readonly string[];
  trustLevel: ModeratorTrustLevel;
  scopeKind: ModeratorGrantScopeKind;
  scopeId: string | null;
  availability: ModeratorGrantAvailability;
  assignedByUserId: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  revocationReason: string | null;
  assignedAt: string;
  status: "active" | "expired" | "revoked";
};

type ModeratorAdminAuditLog = {
  id: string;
  targetUserId: string;
  targetDisplayName: string | null;
  roleId: string;
  roleKey: string | null;
  roleName: string | null;
  actorUserId: string | null;
  actorDisplayName: string | null;
  action: RoleGrantAuditAction;
  reason: string | null;
  createdAt: string;
};

type ModeratorAdminListResponse =
  | {
    ok: true;
    users: readonly ModeratorAdminUser[];
    rankPaths: readonly ModeratorAdminRankPath[];
    roles: readonly ModeratorAdminRole[];
    grants: readonly ModeratorAdminGrant[];
    auditLogs: readonly ModeratorAdminAuditLog[];
    canManageRanks: boolean;
  }
  | {
    ok: false;
    reason: string;
  };

type ModeratorAdminMutationResponse =
  | {
    ok: true;
    grant: ModeratorAdminGrant;
    auditLog: ModeratorAdminAuditLog;
  }
  | {
    ok: false;
    reason: string;
    issues?: readonly string[];
  };

type RankPathMutationResponse =
  | {
    ok: true;
    rankPath: ModeratorAdminRankPath;
  }
  | {
    ok: false;
    reason: string;
  };

type RoleMutationResponse =
  | {
    ok: true;
    role: ModeratorAdminRole;
  }
  | {
    ok: false;
    reason: string;
  };

type LoadState = "loading" | "ready" | "signed-out" | "forbidden" | "failed";

type GrantFormState = {
  targetUserId: string;
  roleId: string;
  trustLevel: GrantableModeratorTrustLevel;
  scopeKind: ModeratorGrantScopeKind;
  scopeId: string;
  availability: ModeratorGrantAvailability;
  expiresAt: string;
  reason: string;
};

type RankPathFormState = {
  id: string | null;
  key: string;
  name: string;
  description: string;
  sortOrder: string;
};

type RoleFormState = {
  id: string | null;
  key: string;
  name: string;
  permissions: string;
  rankPathId: string;
  rankLevel: string;
  displayLabel: string;
  nextRoleId: string;
  discordRoleId: string;
  isOwnerRank: boolean;
  isSystem: boolean;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

const trustLevelLabels: Record<ModeratorTrustLevel, string> = {
  observer: "Observer",
  helper: "Helper",
  moderator: "Moderator",
  senior_moderator: "Senior moderator",
  trusted_operator: "Trusted operator",
  owner: "Owner"
};

const scopeLabels: Record<ModeratorGrantScopeKind, string> = {
  global: "Global",
  chat: "Chat",
  event_routing: "Event routing",
  content: "Content",
  project: "Project",
  stream_operations: "Stream operations"
};

const availabilityLabels: Record<ModeratorGrantAvailability, string> = {
  always: "Always",
  live_only: "Live only",
  offline_only: "Offline only"
};

const actionLabels: Record<RoleGrantAuditAction, string> = {
  grant: "Granted",
  update: "Updated",
  revoke: "Revoked",
  expire: "Expired"
};

const emptyForm: GrantFormState = {
  targetUserId: "",
  roleId: "",
  trustLevel: "helper",
  scopeKind: "global",
  scopeId: "",
  availability: "always",
  expiresAt: "",
  reason: ""
};

const emptyRankPathForm: RankPathFormState = {
  id: null,
  key: "",
  name: "",
  description: "",
  sortOrder: "0"
};

const emptyRoleForm: RoleFormState = {
  id: null,
  key: "",
  name: "",
  permissions: "",
  rankPathId: "",
  rankLevel: "",
  displayLabel: "",
  nextRoleId: "",
  discordRoleId: "",
  isOwnerRank: false,
  isSystem: false
};

const formatDate = (value: string | null): string =>
  value
    ? new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(new Date(value))
    : "None";

const toDateTimeInput = (value: string | null): string =>
  value ? value.slice(0, 16) : "";

const toIsoOrNull = (value: string): string | null =>
  value.trim().length > 0 ? new Date(value).toISOString() : null;

const getFailureMessage = (response: Response, reason?: string, issues?: readonly string[]): string => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "Sign in before managing helper and moderator grants.";
  }

  if (response.status === 403 || reason === "moderator_admin_forbidden") {
    return "Your account does not have moderator management permission.";
  }

  if (reason === "moderator_admin_role_forbidden") {
    return issues && issues.length > 0
      ? `That role cannot be granted here: ${issues.join(", ")}.`
      : "That role contains owner-only or dangerous capabilities.";
  }

  if (reason === "moderator_admin_grant_exists") {
    return "That user already has an active grant for the selected role.";
  }

  if (reason === "moderator_admin_invalid_input") {
    return issues && issues.length > 0
      ? `Invalid grant: ${issues.join(", ")}.`
      : "The grant has invalid or missing fields.";
  }

  return `Moderator admin request failed with ${response.status}.`;
};

const getLoadStateForFailure = (response: Response, reason?: string): LoadState => {
  if (response.status === 401 || reason === "not_authenticated") {
    return "signed-out";
  }

  if (response.status === 403 || reason === "moderator_admin_forbidden" || reason === "moderator_admin_user_unlinked") {
    return "forbidden";
  }

  return "failed";
};

const getUserLabel = (users: readonly ModeratorAdminUser[], userId: string | null): string => {
  if (!userId) {
    return "Unknown user";
  }

  const user = users.find((candidate) => candidate.id === userId);
  return user ? `${user.displayName}${user.authEmail ? ` (${user.authEmail})` : ""}` : userId;
};

const toPayload = (form: GrantFormState) => ({
  targetUserId: form.targetUserId,
  roleId: form.roleId,
  trustLevel: form.trustLevel,
  scopeKind: form.scopeKind,
  scopeId: form.scopeKind === "global" ? null : form.scopeId.trim() || null,
  availability: form.availability,
  expiresAt: toIsoOrNull(form.expiresAt),
  reason: form.reason.trim() || null
});

const toUpdatePayload = (form: GrantFormState) => ({
  trustLevel: form.trustLevel,
  scopeKind: form.scopeKind,
  scopeId: form.scopeKind === "global" ? null : form.scopeId.trim() || null,
  availability: form.availability,
  expiresAt: toIsoOrNull(form.expiresAt),
  reason: form.reason.trim() || null
});

const parsePermissionText = (value: string): string[] =>
  [...new Set(value
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean))]
    .sort();

const toRankPathPayload = (form: RankPathFormState) => ({
  key: form.key,
  name: form.name,
  description: form.description.trim() || null,
  sortOrder: Number.parseInt(form.sortOrder, 10) || 0
});

const toRolePayload = (form: RoleFormState) => ({
  key: form.key,
  name: form.name,
  permissions: parsePermissionText(form.permissions),
  rankPathId: form.rankPathId || null,
  rankLevel: form.rankLevel ? Number.parseInt(form.rankLevel, 10) : null,
  displayLabel: form.displayLabel.trim() || null,
  nextRoleId: form.nextRoleId || null,
  discordRoleId: form.discordRoleId.trim() || null,
  isOwnerRank: form.isOwnerRank,
  isSystem: form.isSystem
});

const getRankPathLabel = (
  rankPaths: readonly ModeratorAdminRankPath[],
  rankPathId: string | null
): string => {
  if (!rankPathId) {
    return "No path";
  }

  const rankPath = rankPaths.find((candidate) => candidate.id === rankPathId);
  return rankPath ? rankPath.name : rankPathId;
};

const ModeratorAdminClient = (): React.ReactNode => {
  const [users, setUsers] = useState<readonly ModeratorAdminUser[]>([]);
  const [rankPaths, setRankPaths] = useState<readonly ModeratorAdminRankPath[]>([]);
  const [roles, setRoles] = useState<readonly ModeratorAdminRole[]>([]);
  const [grants, setGrants] = useState<readonly ModeratorAdminGrant[]>([]);
  const [auditLogs, setAuditLogs] = useState<readonly ModeratorAdminAuditLog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [editingGrantId, setEditingGrantId] = useState<string | null>(null);
  const [form, setForm] = useState<GrantFormState>(emptyForm);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading moderator admin...");
  const [busy, setBusy] = useState<boolean>(false);
  const [canManageRanks, setCanManageRanks] = useState<boolean>(false);
  const [rankPathForm, setRankPathForm] = useState<RankPathFormState>(emptyRankPathForm);
  const [roleForm, setRoleForm] = useState<RoleFormState>(emptyRoleForm);

  const grantableRoles = useMemo(
    () => roles.filter((role) => role.grantable),
    [roles]
  );

  const selectedUserGrants = useMemo(
    () => grants.filter((grant) => grant.userId === selectedUserId),
    [grants, selectedUserId]
  );

  const selectedGrant = useMemo(
    () => grants.find((grant) => grant.id === editingGrantId) ?? null,
    [editingGrantId, grants]
  );

  const parseJson = async <ResponseBody,>(response: Response): Promise<ResponseBody | null> => {
    try {
      return await response.json() as ResponseBody;
    } catch {
      return null;
    }
  };

  const loadModeratorAdmin = useCallback(async (): Promise<void> => {
    setLoadState("loading");
    setMessage("Loading moderator admin...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/moderators`, {
        headers: createApiHeaders(),
        credentials: "include"
      });
      const payload = await parseJson<ModeratorAdminListResponse>(response);

      if (response.ok && payload?.ok) {
        setUsers(payload.users);
        setRankPaths(payload.rankPaths);
        setRoles(payload.roles);
        setGrants(payload.grants);
        setAuditLogs(payload.auditLogs);
        setCanManageRanks(payload.canManageRanks);
        setSelectedUserId((current) => current || payload.users[0]?.id || "");
        setForm((current) => ({
          ...current,
          targetUserId: current.targetUserId || payload.users[0]?.id || "",
          roleId: current.roleId || payload.roles.find((role) => role.grantable)?.id || ""
        }));
        setLoadState("ready");
        setMessage("Moderator admin loaded.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      setLoadState(getLoadStateForFailure(response, reason));
      setMessage(getFailureMessage(response, reason));
    } catch (error) {
      setLoadState("failed");
      setMessage(error instanceof Error ? error.message : "Moderator admin request failed.");
    }
  }, []);

  useEffect(() => {
    captureDevAuthTokenFromUrl();
    void loadModeratorAdmin();
  }, [loadModeratorAdmin]);

  const resetForm = (): void => {
    setEditingGrantId(null);
    setForm({
      ...emptyForm,
      targetUserId: selectedUserId || users[0]?.id || "",
      roleId: grantableRoles[0]?.id || ""
    });
  };

  const resetRankPathForm = (): void => {
    setRankPathForm(emptyRankPathForm);
  };

  const resetRoleForm = (): void => {
    setRoleForm({
      ...emptyRoleForm,
      rankPathId: rankPaths[0]?.id ?? ""
    });
  };

  const startEdit = (grant: ModeratorAdminGrant): void => {
    setEditingGrantId(grant.id);
    setSelectedUserId(grant.userId);
    setForm({
      targetUserId: grant.userId,
      roleId: grant.roleId,
      trustLevel: grant.trustLevel === "owner" ? "helper" : grant.trustLevel,
      scopeKind: grant.scopeKind,
      scopeId: grant.scopeId ?? "",
      availability: grant.availability,
      expiresAt: toDateTimeInput(grant.expiresAt),
      reason: ""
    });
  };

  const applyMutation = (grant: ModeratorAdminGrant, auditLog: ModeratorAdminAuditLog): void => {
    setGrants((current) => {
      const exists = current.some((candidate) => candidate.id === grant.id);
      return exists
        ? current.map((candidate) => candidate.id === grant.id ? grant : candidate)
        : [grant, ...current];
    });
    setAuditLogs((current) => [auditLog, ...current].slice(0, 50));
    setSelectedUserId(grant.userId);
  };

  const saveRankPath = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setMessage(rankPathForm.id ? "Updating rank path..." : "Creating rank path...");

    try {
      const response = await fetch(`${apiBaseUrl}${rankPathForm.id ? `/admin/moderators/rank-paths/${encodeURIComponent(rankPathForm.id)}` : "/admin/moderators/rank-paths"}`, {
        method: rankPathForm.id ? "PATCH" : "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify(toRankPathPayload(rankPathForm))
      });
      const payload = await parseJson<RankPathMutationResponse>(response);

      if (response.ok && payload?.ok) {
        setRankPaths((current) => {
          const exists = current.some((candidate) => candidate.id === payload.rankPath.id);
          return exists
            ? current.map((candidate) => candidate.id === payload.rankPath.id ? payload.rankPath : candidate)
            : [...current, payload.rankPath].sort((left, right) => left.sortOrder - right.sortOrder || left.key.localeCompare(right.key));
        });
        setMessage(rankPathForm.id ? "Rank path updated." : "Rank path created.");
        resetRankPathForm();
        return;
      }

      setMessage(payload?.ok === false ? payload.reason : `Rank path request failed with ${response.status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving rank path failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveRole = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setBusy(true);
    setMessage(roleForm.id ? "Updating role..." : "Creating role...");

    try {
      const response = await fetch(`${apiBaseUrl}${roleForm.id ? `/admin/moderators/roles/${encodeURIComponent(roleForm.id)}` : "/admin/moderators/roles"}`, {
        method: roleForm.id ? "PATCH" : "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify(toRolePayload(roleForm))
      });
      const payload = await parseJson<RoleMutationResponse>(response);

      if (response.ok && payload?.ok) {
        setRoles((current) => {
          const exists = current.some((candidate) => candidate.id === payload.role.id);
          return exists
            ? current.map((candidate) => candidate.id === payload.role.id ? payload.role : candidate)
            : [...current, payload.role];
        });
        setMessage(roleForm.id ? "Role updated." : "Role created.");
        resetRoleForm();
        return;
      }

      setMessage(payload?.ok === false ? payload.reason : `Role request failed with ${response.status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving role failed.");
    } finally {
      setBusy(false);
    }
  };

  const saveGrant = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();

    if (!form.targetUserId || !form.roleId) {
      setMessage("Choose a user and a grantable role first.");
      return;
    }

    setBusy(true);
    setMessage(editingGrantId ? "Updating role grant..." : "Granting role...");

    try {
      const response = await fetch(`${apiBaseUrl}${editingGrantId ? `/admin/moderators/grants/${encodeURIComponent(editingGrantId)}` : "/admin/moderators/grants"}`, {
        method: editingGrantId ? "PATCH" : "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify(editingGrantId ? toUpdatePayload(form) : toPayload(form))
      });
      const payload = await parseJson<ModeratorAdminMutationResponse>(response);

      if (response.ok && payload?.ok) {
        applyMutation(payload.grant, payload.auditLog);
        setEditingGrantId(null);
        setMessage(editingGrantId ? "Role grant updated." : "Role granted.");
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      const issues = payload?.ok === false ? payload.issues : undefined;
      setMessage(getFailureMessage(response, reason, issues));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Saving role grant failed.");
    } finally {
      setBusy(false);
    }
  };

  const revokeGrant = async (grant: ModeratorAdminGrant): Promise<void> => {
    setBusy(true);
    setMessage("Revoking role grant...");

    try {
      const response = await fetch(`${apiBaseUrl}/admin/moderators/grants/${encodeURIComponent(grant.id)}/revoke`, {
        method: "POST",
        headers: createApiHeaders({
          "Content-Type": "application/json"
        }),
        credentials: "include",
        body: JSON.stringify({
          reason: form.reason.trim() || "Revoked from moderator admin"
        })
      });
      const payload = await parseJson<ModeratorAdminMutationResponse>(response);

      if (response.ok && payload?.ok) {
        applyMutation(payload.grant, payload.auditLog);
        setMessage("Role grant revoked.");
        if (editingGrantId === grant.id) {
          resetForm();
        }
        return;
      }

      const reason = payload?.ok === false ? payload.reason : undefined;
      const issues = payload?.ok === false ? payload.issues : undefined;
      setMessage(getFailureMessage(response, reason, issues));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Revoking role grant failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="project-admin-header">
        <p className="eyebrow">Owner admin</p>
        <h1>Moderators</h1>
        <p>{grants.length} role grant{grants.length === 1 ? "" : "s"} across {users.length} user{users.length === 1 ? "" : "s"}.</p>
      </header>

      <section className={`project-admin-state ${loadState}`}>
        <h2>{loadState === "ready" ? "Ready" : loadState === "loading" ? "Loading" : "Needs attention"}</h2>
        <p>{message}</p>
      </section>

      {loadState === "ready" ? (
        <div className="project-admin-layout">
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
                  onClick={() => {
                    setSelectedUserId(user.id);
                    setForm((current) => ({ ...current, targetUserId: user.id }));
                  }}
                >
                  <strong>{user.displayName}</strong>
                  <span>{user.authEmail ?? user.profileVisibility}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="project-admin-workspace" aria-label="Moderator grant editor">
            <section className="project-admin-panel visibility-panel">
              <div className="project-admin-panel-heading">
                <div>
                  <h2>{getUserLabel(users, selectedUserId)}</h2>
                  <p>Current helper and moderator grants.</p>
                </div>
                <div className="project-admin-actions">
                  <button type="button" onClick={resetForm} disabled={busy}>New grant</button>
                </div>
              </div>

              {selectedUserGrants.length === 0 ? (
                <p className="project-admin-note">No role grants for this user.</p>
              ) : (
                <ul className="project-admin-record-list">
                  {selectedUserGrants.map((grant) => (
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
                        <button type="button" onClick={() => startEdit(grant)} disabled={busy || grant.status === "revoked"}>Edit</button>
                        <button type="button" onClick={() => void revokeGrant(grant)} disabled={busy || grant.status === "revoked"}>Revoke</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <form className="project-admin-panel project-admin-form moderator-admin-form" onSubmit={(event) => void saveGrant(event)}>
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
                {editingGrantId ? <button type="button" onClick={resetForm} disabled={busy}>Cancel edit</button> : null}
              </div>
            </form>

            {canManageRanks ? (
              <section className="project-admin-panel project-admin-form">
                <div className="project-admin-panel-heading">
                  <div>
                    <h2>Rank Paths</h2>
                    <p>Owner-only role paths and promotion lanes.</p>
                  </div>
                  <div className="project-admin-actions">
                    <button type="button" onClick={resetRankPathForm} disabled={busy}>New path</button>
                  </div>
                </div>

                <form className="project-admin-form-grid" onSubmit={(event) => void saveRankPath(event)}>
                  <label>
                    Key
                    <input value={rankPathForm.key} onChange={(event) => setRankPathForm((current) => ({ ...current, key: event.target.value }))} maxLength={80} />
                  </label>
                  <label>
                    Name
                    <input value={rankPathForm.name} onChange={(event) => setRankPathForm((current) => ({ ...current, name: event.target.value }))} maxLength={191} />
                  </label>
                  <label>
                    Sort
                    <input type="number" min={0} value={rankPathForm.sortOrder} onChange={(event) => setRankPathForm((current) => ({ ...current, sortOrder: event.target.value }))} />
                  </label>
                  <label>
                    Description
                    <input value={rankPathForm.description} onChange={(event) => setRankPathForm((current) => ({ ...current, description: event.target.value }))} maxLength={280} />
                  </label>
                  <div className="project-admin-actions">
                    <button type="submit" disabled={busy}>{rankPathForm.id ? "Save path" : "Create path"}</button>
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
                          onClick={() => setRankPathForm({
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
            ) : null}

            {canManageRanks ? (
              <section className="project-admin-panel project-admin-form">
                <div className="project-admin-panel-heading">
                  <div>
                    <h2>Role Rights</h2>
                    <p>Owner-only action rights collected by ranks.</p>
                  </div>
                  <div className="project-admin-actions">
                    <button type="button" onClick={resetRoleForm} disabled={busy}>New role</button>
                  </div>
                </div>

                <form className="project-admin-form-grid" onSubmit={(event) => void saveRole(event)}>
                  <label>
                    Key
                    <input value={roleForm.key} onChange={(event) => setRoleForm((current) => ({ ...current, key: event.target.value }))} maxLength={80} />
                  </label>
                  <label>
                    Name
                    <input value={roleForm.name} onChange={(event) => setRoleForm((current) => ({ ...current, name: event.target.value }))} maxLength={191} />
                  </label>
                  <label>
                    Rank path
                    <select value={roleForm.rankPathId} onChange={(event) => setRoleForm((current) => ({ ...current, rankPathId: event.target.value }))}>
                      <option value="">No path</option>
                      {rankPaths.map((rankPath) => (
                        <option key={rankPath.id} value={rankPath.id}>{rankPath.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Level
                    <input type="number" min={1} value={roleForm.rankLevel} onChange={(event) => setRoleForm((current) => ({ ...current, rankLevel: event.target.value }))} />
                  </label>
                  <label>
                    Display label
                    <input value={roleForm.displayLabel} onChange={(event) => setRoleForm((current) => ({ ...current, displayLabel: event.target.value }))} maxLength={191} />
                  </label>
                  <label>
                    Next promotion
                    <select value={roleForm.nextRoleId} onChange={(event) => setRoleForm((current) => ({ ...current, nextRoleId: event.target.value }))}>
                      <option value="">None</option>
                      {roles.map((role) => (
                        <option key={role.id} value={role.id}>{role.name}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Discord role ID
                    <input value={roleForm.discordRoleId} onChange={(event) => setRoleForm((current) => ({ ...current, discordRoleId: event.target.value }))} maxLength={80} />
                  </label>
                  <label>
                    Permissions
                    <textarea value={roleForm.permissions} onChange={(event) => setRoleForm((current) => ({ ...current, permissions: event.target.value }))} rows={4} />
                  </label>
                  <label className="project-admin-checkbox">
                    <input type="checkbox" checked={roleForm.isOwnerRank} onChange={(event) => setRoleForm((current) => ({ ...current, isOwnerRank: event.target.checked }))} />
                    Owner rank
                  </label>
                  <label className="project-admin-checkbox">
                    <input type="checkbox" checked={roleForm.isSystem} onChange={(event) => setRoleForm((current) => ({ ...current, isSystem: event.target.checked }))} />
                    System/default rank
                  </label>
                  <div className="project-admin-actions">
                    <button type="submit" disabled={busy}>{roleForm.id ? "Save role" : "Create role"}</button>
                  </div>
                </form>
              </section>
            ) : null}

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

            <section className="project-admin-panel project-admin-note">
              <h2>Owner-only</h2>
              <p>Owner/admin assignment, production auth and secrets, provider credentials, real money authority, irreversible user deletion, role-management permission, and audit log disabling stay unavailable from this page.</p>
            </section>
          </section>
        </div>
      ) : null}
    </>
  );
};

export default ModeratorAdminClient;
