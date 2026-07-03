"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
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

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import {
  actionLabels,
  apiBaseUrl,
  availabilityLabels,
  emptyForm,
  emptyRankPathForm,
  emptyRoleForm,
  formatDate,
  getFailureMessage,
  getLoadStateForFailure,
  getRankPathLabel,
  getUserLabel,
  scopeLabels,
  toDateTimeInput,
  toPayload,
  toRankPathPayload,
  toRolePayload,
  toUpdatePayload,
  trustLevelLabels,
  type GrantFormState,
  type LoadState,
  type ModeratorAdminAuditLog,
  type ModeratorAdminGrant,
  type ModeratorAdminListResponse,
  type ModeratorAdminMutationResponse,
  type ModeratorAdminRankPath,
  type ModeratorAdminRole,
  type ModeratorAdminUser,
  type RankPathFormState,
  type RankPathMutationResponse,
  type RoleFormState,
  type RoleMutationResponse
} from "./moderator-admin-client.service";

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
