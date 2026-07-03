"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import { captureDevAuthTokenFromUrl, createApiHeaders } from "../../dev-auth-token";
import {
  AuditPanel,
  GrantFormPanel,
  GrantsPanel,
  OwnerOnlyNote,
  RankPathsPanel,
  RoleRightsPanel,
  RolesPanel,
  UsersSidebar
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
          <UsersSidebar
            users={users}
            selectedUserId={selectedUserId}
            onSelectUser={(userId) => {
              setSelectedUserId(userId);
              setForm((current) => ({ ...current, targetUserId: userId }));
            }}
          />

          <section className="project-admin-workspace" aria-label="Moderator grant editor">
            <GrantsPanel
              users={users}
              selectedUserId={selectedUserId}
              grants={selectedUserGrants}
              busy={busy}
              onNewGrant={resetForm}
              onEditGrant={startEdit}
              onRevokeGrant={(grant) => void revokeGrant(grant)}
            />

            <GrantFormPanel
              users={users}
              grantableRoles={grantableRoles}
              selectedGrant={selectedGrant}
              editingGrantId={editingGrantId}
              form={form}
              busy={busy}
              onSubmit={(event) => void saveGrant(event)}
              onCancelEdit={resetForm}
              setForm={setForm}
            />

            {canManageRanks ? (
              <RankPathsPanel
                rankPaths={rankPaths}
                form={rankPathForm}
                busy={busy}
                onSubmit={(event) => void saveRankPath(event)}
                onNewPath={resetRankPathForm}
                setForm={setRankPathForm}
              />
            ) : null}

            {canManageRanks ? (
              <RoleRightsPanel
                rankPaths={rankPaths}
                roles={roles}
                form={roleForm}
                busy={busy}
                onSubmit={(event) => void saveRole(event)}
                onNewRole={resetRoleForm}
                setForm={setRoleForm}
              />
            ) : null}

            <RolesPanel
              rankPaths={rankPaths}
              roles={roles}
              busy={busy}
              canManageRanks={canManageRanks}
              setRoleForm={setRoleForm}
            />

            <AuditPanel auditLogs={auditLogs} />

            <OwnerOnlyNote />
          </section>
        </div>
      ) : null}
    </>
  );
};

export default ModeratorAdminClient;
