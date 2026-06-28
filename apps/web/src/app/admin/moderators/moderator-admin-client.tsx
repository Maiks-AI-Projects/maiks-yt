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
  grantable: boolean;
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
    roles: readonly ModeratorAdminRole[];
    grants: readonly ModeratorAdminGrant[];
    auditLogs: readonly ModeratorAdminAuditLog[];
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

const ModeratorAdminClient = (): React.ReactNode => {
  const [users, setUsers] = useState<readonly ModeratorAdminUser[]>([]);
  const [roles, setRoles] = useState<readonly ModeratorAdminRole[]>([]);
  const [grants, setGrants] = useState<readonly ModeratorAdminGrant[]>([]);
  const [auditLogs, setAuditLogs] = useState<readonly ModeratorAdminAuditLog[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [editingGrantId, setEditingGrantId] = useState<string | null>(null);
  const [form, setForm] = useState<GrantFormState>(emptyForm);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [message, setMessage] = useState<string>("Loading moderator admin...");
  const [busy, setBusy] = useState<boolean>(false);

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
        setRoles(payload.roles);
        setGrants(payload.grants);
        setAuditLogs(payload.auditLogs);
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
                      <p>{role.key} · {role.grantable ? "Grantable" : "Protected"}</p>
                      <p>{role.permissions.length > 0 ? role.permissions.join(", ") : "No permissions"}</p>
                    </div>
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
