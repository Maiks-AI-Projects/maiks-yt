"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import {
  ModeratorAdminWorkspace,
  type ModeratorAdminView,
  type RankEditorMode
} from "./moderator-admin-panels";
import {
  apiBaseUrl,
  emptyForm,
  emptyRankPathForm,
  emptyRoleForm,
  getFailureMessage,
  getLoadStateForFailure,
  toDateTimeInput,
  toPayload,
  toRankPathPayload,
  toRolePayload,
  toUpdatePayload,
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

const getRoleForm = (role: ModeratorAdminRole): RoleFormState => ({
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
});

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
  const [view, setView] = useState<ModeratorAdminView>("ranks");
  const [rankEditorMode, setRankEditorMode] = useState<RankEditorMode>("role");
  const [selectedRankPathId, setSelectedRankPathId] = useState<string>("");
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);

  const grantableRoles = useMemo(
    () => roles.filter((role) => role.grantable),
    [roles]
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
        const defaultPath = payload.rankPaths.find((path) => path.key === "mod") ?? payload.rankPaths[0] ?? null;
        const defaultRole = payload.roles.find((role) => role.rankPathId === defaultPath?.id && role.rankLevel === 2)
          ?? payload.roles.find((role) => role.rankPathId === defaultPath?.id)
          ?? payload.roles[0]
          ?? null;
        setUsers(payload.users);
        setRankPaths(payload.rankPaths);
        setRoles(payload.roles);
        setGrants(payload.grants);
        setAuditLogs(payload.auditLogs);
        setCanManageRanks(payload.canManageRanks);
        setSelectedRankPathId((current) => current || defaultPath?.id || "");
        setSelectedRoleId((current) => current ?? defaultRole?.id ?? null);
        if (defaultRole) {
          setRoleForm((current) => current.id ? current : getRoleForm(defaultRole));
        }
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

  const resetForm = (targetUserId?: string): void => {
    setEditingGrantId(null);
    const nextUserId = targetUserId || selectedUserId || users[0]?.id || "";
    setSelectedUserId(nextUserId);
    setForm({
      ...emptyForm,
      targetUserId: nextUserId,
      roleId: grantableRoles[0]?.id || ""
    });
    setView("grants");
  };

  const resetRankPathForm = (): void => {
    setRankPathForm(emptyRankPathForm);
    setRankEditorMode("path");
    setView("ranks");
  };

  const resetRoleForm = (): void => {
    setSelectedRoleId(null);
    setRankEditorMode("role");
    setRoleForm({
      ...emptyRoleForm,
      rankPathId: selectedRankPathId || rankPaths[0]?.id || ""
    });
    setView("ranks");
  };

  const cancelRoleEdit = (): void => {
    const selectedRole = roles.find((role) => role.id === selectedRoleId)
      ?? roles.find((role) => role.rankPathId === selectedRankPathId)
      ?? null;
    if (selectedRole) {
      selectRole(selectedRole);
      return;
    }
    setRoleForm(emptyRoleForm);
  };

  const selectRankPath = (rankPathId: string): void => {
    const nextRole = roles
      .filter((role) => role.rankPathId === rankPathId)
      .sort((left, right) => (left.rankLevel ?? 999) - (right.rankLevel ?? 999))[0] ?? null;
    setSelectedRankPathId(rankPathId);
    setSelectedRoleId(nextRole?.id ?? null);
    setRankEditorMode("role");
    if (nextRole) setRoleForm(getRoleForm(nextRole));
  };

  const selectRole = (role: ModeratorAdminRole): void => {
    setSelectedRoleId(role.id);
    setSelectedRankPathId(role.rankPathId ?? selectedRankPathId);
    setRoleForm(getRoleForm(role));
    setRankEditorMode("role");
  };

  const editRankPath = (rankPath: ModeratorAdminRankPath): void => {
    setRankPathForm({
      id: rankPath.id,
      key: rankPath.key,
      name: rankPath.name,
      description: rankPath.description ?? "",
      sortOrder: String(rankPath.sortOrder)
    });
    setRankEditorMode("path");
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
    setView("grants");
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
        setSelectedRankPathId(payload.rankPath.id);
        setRankPathForm({
          id: payload.rankPath.id,
          key: payload.rankPath.key,
          name: payload.rankPath.name,
          description: payload.rankPath.description ?? "",
          sortOrder: String(payload.rankPath.sortOrder)
        });
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
        setSelectedRoleId(payload.role.id);
        setSelectedRankPathId(payload.role.rankPathId ?? selectedRankPathId);
        setRoleForm(getRoleForm(payload.role));
        setMessage(roleForm.id ? "Role updated." : "Role created.");
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
    if (!window.confirm(`Revoke ${grant.roleName}? This change is recorded in the grant audit.`)) {
      return;
    }

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
      {loadState !== "ready" ? <>
        <header className="project-admin-header">
          <p className="eyebrow">Owner admin</p>
          <h1>Moderators</h1>
          <p>Ranks, rights and access grants.</p>
        </header>
        <section className={`project-admin-state ${loadState}`}>
          <h2>{loadState === "loading" ? "Loading" : "Needs attention"}</h2>
          <p>{message}</p>
        </section>
      </> : null}

      {loadState === "ready" ? <ModeratorAdminWorkspace
        users={users}
        rankPaths={rankPaths}
        roles={roles}
        grants={grants}
        auditLogs={auditLogs}
        selectedUserId={selectedUserId}
        selectedRankPathId={selectedRankPathId}
        selectedRoleId={selectedRoleId}
        editingGrantId={editingGrantId}
        view={view}
        rankEditorMode={rankEditorMode}
        grantForm={form}
        rankPathForm={rankPathForm}
        roleForm={roleForm}
        busy={busy}
        message={message}
        canManageRanks={canManageRanks}
        onViewChange={setView}
        onSelectUser={(userId) => {
          setSelectedUserId(userId);
          setForm((current) => ({ ...current, targetUserId: userId }));
        }}
        onSelectRankPath={selectRankPath}
        onSelectRole={selectRole}
        onNewGrant={resetForm}
        onEditGrant={startEdit}
        onRevokeGrant={(grant) => void revokeGrant(grant)}
        onSaveGrant={(event) => void saveGrant(event)}
        onCancelGrant={() => resetForm(selectedUserId)}
        onNewPath={resetRankPathForm}
        onEditPath={editRankPath}
        onSavePath={(event) => void saveRankPath(event)}
        onNewRole={resetRoleForm}
        onSaveRole={(event) => void saveRole(event)}
        onCancelRole={cancelRoleEdit}
        setGrantForm={setForm}
        setRankPathForm={setRankPathForm}
        setRoleForm={setRoleForm}
      /> : null}
    </>
  );
};

export default ModeratorAdminClient;
