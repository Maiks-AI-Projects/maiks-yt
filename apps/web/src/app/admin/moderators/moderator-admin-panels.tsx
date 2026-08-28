"use client";

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
import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { FiChevronRight, FiEdit2, FiLock, FiPlus, FiSearch, FiShield, FiUser, FiUsers, FiX } from "react-icons/fi";

import {
  actionLabels,
  availabilityLabels,
  formatDate,
  parsePermissionText,
  rankPathIsProtectedForEditing,
  roleIsProtectedForEditing,
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
import styles from "./moderator-admin.module.css";

export type ModeratorAdminView = "grants" | "ranks";
export type RankEditorMode = "path" | "role";

export type ModeratorAdminWorkspaceProps = {
  users: readonly ModeratorAdminUser[];
  rankPaths: readonly ModeratorAdminRankPath[];
  roles: readonly ModeratorAdminRole[];
  grants: readonly ModeratorAdminGrant[];
  auditLogs: readonly ModeratorAdminAuditLog[];
  selectedUserId: string;
  selectedRankPathId: string;
  selectedRoleId: string | null;
  editingGrantId: string | null;
  view: ModeratorAdminView;
  rankEditorMode: RankEditorMode;
  grantForm: GrantFormState;
  rankPathForm: RankPathFormState;
  roleForm: RoleFormState;
  busy: boolean;
  message: string;
  canManageRanks: boolean;
  onViewChange: (view: ModeratorAdminView) => void;
  onSelectUser: (userId: string) => void;
  onSelectRankPath: (rankPathId: string) => void;
  onSelectRole: (role: ModeratorAdminRole) => void;
  onNewGrant: (userId?: string) => void;
  onEditGrant: (grant: ModeratorAdminGrant) => void;
  onRevokeGrant: (grant: ModeratorAdminGrant) => void;
  onSaveGrant: (event: FormEvent<HTMLFormElement>) => void;
  onCancelGrant: () => void;
  onNewPath: () => void;
  onEditPath: (rankPath: ModeratorAdminRankPath) => void;
  onSavePath: (event: FormEvent<HTMLFormElement>) => void;
  onDeletePath: () => void;
  onNewRole: () => void;
  onSaveRole: (event: FormEvent<HTMLFormElement>) => void;
  onDeleteRole: () => void;
  onCancelRole: () => void;
  setGrantForm: Dispatch<SetStateAction<GrantFormState>>;
  setRankPathForm: Dispatch<SetStateAction<RankPathFormState>>;
  setRoleForm: Dispatch<SetStateAction<RoleFormState>>;
};

const permissionLabels: Record<string, string> = {
  "chat:view": "View chat",
  "chat:allow-message": "Allow message",
  "chat:hide-message": "Hide message",
  "chat:warn-user": "Warn user",
  "chat:emergency-clear": "Emergency clear",
  "chat:ban-user-local": "Local ban",
  "moderation-rules:view": "View active rules",
  "moderation-rules:retract": "Retract rule"
};

const Avatar = ({ user }: { user: ModeratorAdminUser }): React.ReactNode => (
  <span className={styles.avatar} aria-hidden="true">
    {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <FiUser />}
  </span>
);

const getPathRoles = (roles: readonly ModeratorAdminRole[], pathId: string): readonly ModeratorAdminRole[] =>
  roles.filter((role) => role.rankPathId === pathId)
    .sort((left, right) => (left.rankLevel ?? 999) - (right.rankLevel ?? 999));

const getUser = (users: readonly ModeratorAdminUser[], userId: string): ModeratorAdminUser | null =>
  users.find((user) => user.id === userId) ?? null;

const grantIsProtected = (roles: readonly ModeratorAdminRole[], grant: ModeratorAdminGrant): boolean => {
  const role = roles.find((candidate) => candidate.id === grant.roleId);
  return !role || !role.grantable || roleIsProtectedForEditing(role);
};

const PathRail = (props: ModeratorAdminWorkspaceProps): React.ReactNode => (
  <aside className={styles.rail} aria-label="Promotion paths and active grants">
    <div className={styles.headingRow}><h2>Promotion paths</h2><button className={styles.textButton} type="button" onClick={props.onNewPath} disabled={props.busy}><FiPlus /> New path</button></div>
    <div className={styles.pathList}>
      {props.rankPaths.map((path) => {
        const pathRoles = getPathRoles(props.roles, path.id);
        const finalRole = pathRoles.at(-1);
        const nextRole = props.roles.find((role) => role.id === finalRole?.nextRoleId);
        return (
          <button key={path.id} type="button" className={`${styles.pathItem} ${path.id === props.selectedRankPathId ? styles.selected : ""}`} onClick={() => props.onSelectRankPath(path.id)}>
            {path.key === "owner" ? <FiShield /> : <FiUsers />}
            <span><strong>{path.name}</strong><small>{path.key === "owner" ? `${pathRoles.length} protected rank` : `${pathRoles.length} rank${pathRoles.length === 1 ? "" : "s"}${nextRole ? ` · leads to ${nextRole.displayLabel ?? nextRole.name}` : ""}`}</small></span>
            <FiChevronRight />
          </button>
        );
      })}
    </div>
    <div className={styles.divider} />
    <div className={styles.headingRow}><h2>Current grants</h2><button className={styles.textButton} type="button" onClick={() => props.onNewGrant()}>Add grant</button></div>
    <div className={styles.compactList}>
      {props.grants.filter((grant) => grant.status === "active").slice(0, 4).map((grant) => {
        const user = getUser(props.users, grant.userId);
        if (!user) return null;
        return <button key={grant.id} type="button" disabled={grantIsProtected(props.roles, grant)} onClick={() => props.onEditGrant(grant)}><Avatar user={user} /><span><strong>{user.displayName}</strong><small>{grant.roleName}</small></span><em data-tone={grant.availability === "live_only" ? "amber" : "mint"}>{availabilityLabels[grant.availability]}</em></button>;
      })}
      {props.users.filter((user) => !props.grants.some((grant) => grant.userId === user.id && grant.status === "active")).slice(0, 2).map((user) => (
        <button key={user.id} type="button" onClick={() => props.onNewGrant(user.id)}><Avatar user={user} /><span><strong>{user.displayName}</strong><small>No helper grant</small></span><em data-tone="muted">None</em></button>
      ))}
    </div>
  </aside>
);

const PromotionTrack = ({ pathRoles, roles, selectedRole }: { pathRoles: readonly ModeratorAdminRole[]; roles: readonly ModeratorAdminRole[]; selectedRole: ModeratorAdminRole | null }): React.ReactNode => {
  const first = pathRoles.slice(0, 3);
  const last = pathRoles.at(-1);
  const externalNext = roles.find((role) => role.id === last?.nextRoleId) ?? null;
  const items: Array<{ key: string; label: string; marker: string; role: ModeratorAdminRole | null }> = first.map((role) => ({ key: role.id, label: `lvl ${role.rankLevel ?? "–"}`, marker: String(role.rankLevel ?? "–"), role }));
  if (pathRoles.length > 3) items.push({ key: "reserved", label: `lvl ${pathRoles[3]?.rankLevel ?? 4}–${last?.rankLevel ?? 10}`, marker: `${pathRoles[3]?.rankLevel ?? 4}–${last?.rankLevel ?? 10}`, role: null });
  if (externalNext) items.push({ key: externalNext.id, label: externalNext.name, marker: "★", role: externalNext });

  return <div className={styles.track}>{items.map((item, index) => <div key={item.key} className={item.role?.id === selectedRole?.id ? styles.current : ""}><span>{item.marker}</span><strong>{item.label}</strong>{index < items.length - 1 ? <i /> : null}</div>)}</div>;
};

const RightsMatrix = ({ role, permissionText, options, busy, setRoleForm }: { role: ModeratorAdminRole | null; permissionText: string; options: readonly string[]; busy: boolean; setRoleForm: Dispatch<SetStateAction<RoleFormState>> }): React.ReactNode => {
  const selected = new Set(parsePermissionText(permissionText));
  const protectedRole = roleIsProtectedForEditing(role);
  const wildcardAuthority = role?.permissions.some((permission) => permission.trim() === "*") ?? false;
  const toggle = (permission: string, enabled: boolean): void => setRoleForm((current) => {
    const next = new Set(parsePermissionText(current.permissions));
    if (enabled) next.add(permission); else next.delete(permission);
    return { ...current, permissions: [...next].sort().join("\n") };
  });
  const groups = [
    ["Chat", options.filter((permission) => permission.startsWith("chat:"))],
    ["Moderation rules", options.filter((permission) => permission.startsWith("moderation-rules:"))],
    ["Other", options.filter((permission) => !permission.startsWith("chat:") && !permission.startsWith("moderation-rules:"))]
  ] as const;

  return <div className={styles.rights}>
    {groups.filter(([, permissions]) => permissions.length > 0).map(([label, permissions]) => <div className={styles.rightGroup} key={label}><strong>{label}</strong><div>{permissions.map((permission) => <label key={permission}><input type="checkbox" checked={wildcardAuthority || selected.has(permission)} disabled={busy || protectedRole} onChange={(event) => toggle(permission, event.target.checked)} /><span>{permissionLabels[permission] ?? permission}</span>{permission === "chat:emergency-clear" ? <em>sensitive</em> : null}</label>)}</div></div>)}
    <p>Rights are checked individually. Rank labels never grant access by themselves.</p>
    {protectedRole ? <div className={styles.lockNote}><FiLock /> This protected rank cannot be changed from this page.</div> : null}
  </div>;
};

const RoleEditor = (props: ModeratorAdminWorkspaceProps & { selectedRole: ModeratorAdminRole | null }): React.ReactNode => {
  const [customRight, setCustomRight] = useState("");
  const protectedRole = roleIsProtectedForEditing(props.selectedRole);
  const addRight = (): void => {
    if (!customRight.trim()) return;
    props.setRoleForm((current) => ({ ...current, permissions: [...new Set([...parsePermissionText(current.permissions), customRight.trim()])].sort().join("\n") }));
    setCustomRight("");
  };
  return <form className={styles.editor} onSubmit={props.onSaveRole}>
    <div className={styles.headingRow}><h2>{props.roleForm.id ? "Edit rank" : "New rank"}</h2></div>
    {!props.roleForm.id ? <label>Key<input value={props.roleForm.key} onChange={(event) => props.setRoleForm((current) => ({ ...current, key: event.target.value }))} required maxLength={80} /></label> : null}
    <label>Name<input value={props.roleForm.name} disabled={protectedRole} onChange={(event) => props.setRoleForm((current) => ({ ...current, name: event.target.value }))} required maxLength={191} /></label>
    <label>Display label<input value={props.roleForm.displayLabel} disabled={protectedRole} onChange={(event) => props.setRoleForm((current) => ({ ...current, displayLabel: event.target.value }))} maxLength={191} /></label>
    <div className={styles.twoCols}><label>Path<select value={props.roleForm.rankPathId} disabled={protectedRole} onChange={(event) => props.setRoleForm((current) => ({ ...current, rankPathId: event.target.value }))}><option value="">No path</option>{props.rankPaths.map((path) => <option key={path.id} value={path.id}>{path.name}</option>)}</select></label><label>Level<input type="number" min={1} value={props.roleForm.rankLevel} disabled={protectedRole} onChange={(event) => props.setRoleForm((current) => ({ ...current, rankLevel: event.target.value }))} /></label></div>
    <label>Next promotion<select value={props.roleForm.nextRoleId} disabled={protectedRole} onChange={(event) => props.setRoleForm((current) => ({ ...current, nextRoleId: event.target.value }))}><option value="">None</option>{props.roles.filter((role) => role.id !== props.roleForm.id).map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
    <label>Discord role ID<input value={props.roleForm.discordRoleId} disabled={protectedRole} onChange={(event) => props.setRoleForm((current) => ({ ...current, discordRoleId: event.target.value }))} maxLength={80} /><small>Future mapping only · sync is not active</small></label>
    <label className={styles.check}><input type="checkbox" checked={props.roleForm.isSystem} disabled={protectedRole} onChange={(event) => props.setRoleForm((current) => ({ ...current, isSystem: event.target.checked }))} /> System/default rank</label>
    <label className={styles.check}><input type="checkbox" checked={props.roleForm.isOwnerRank} disabled={protectedRole} onChange={(event) => props.setRoleForm((current) => ({ ...current, isOwnerRank: event.target.checked }))} /> Owner rank {protectedRole ? <FiLock /> : null}</label>
    {!protectedRole ? <div className={styles.addRight}><label>Custom right<input value={customRight} onChange={(event) => setCustomRight(event.target.value)} placeholder="area:action" /></label><button type="button" onClick={addRight} disabled={!customRight.trim()}>Add</button></div> : null}
    <div className={styles.note}><strong>Grant settings</strong><p>Trust, scope, availability and expiry are chosen on each grant.</p></div>
    <span className={styles.formActions}>{props.roleForm.id ? <button className={styles.danger} type="button" onClick={props.onDeleteRole} disabled={props.busy || protectedRole}>Remove rank</button> : null}<button className={styles.primary} type="submit" disabled={props.busy || protectedRole}>{props.busy ? "Saving…" : "Save rank"}</button><button type="button" onClick={props.onCancelRole} disabled={props.busy}>Cancel</button></span>
  </form>;
};

const PathEditor = (props: ModeratorAdminWorkspaceProps): React.ReactNode => {
  const protectedPath = rankPathIsProtectedForEditing(props.roles, props.rankPathForm.id);
  return <form className={styles.editor} onSubmit={props.onSavePath}>
    <div className={styles.headingRow}><h2>{props.rankPathForm.id ? "Edit path" : "New path"}</h2></div>
    <label>Key<input value={props.rankPathForm.key} disabled={protectedPath} onChange={(event) => props.setRankPathForm((current) => ({ ...current, key: event.target.value }))} required maxLength={80} /></label>
    <label>Name<input value={props.rankPathForm.name} disabled={protectedPath} onChange={(event) => props.setRankPathForm((current) => ({ ...current, name: event.target.value }))} required maxLength={191} /></label>
    <label>Description<textarea rows={4} value={props.rankPathForm.description} disabled={protectedPath} onChange={(event) => props.setRankPathForm((current) => ({ ...current, description: event.target.value }))} maxLength={280} /></label>
    <label>Sort order<input type="number" min={0} value={props.rankPathForm.sortOrder} disabled={protectedPath} onChange={(event) => props.setRankPathForm((current) => ({ ...current, sortOrder: event.target.value }))} /></label>
    <div className={styles.note}><strong>Promotion path</strong><p>Ranks inside this path define their own level and next promotion.</p></div>
    <span className={styles.formActions}>{props.rankPathForm.id ? <button className={styles.danger} type="button" onClick={props.onDeletePath} disabled={props.busy || protectedPath}>Remove path</button> : null}<button className={styles.primary} type="submit" disabled={props.busy || protectedPath}>{props.busy ? "Saving…" : "Save path"}</button></span>
  </form>;
};

const SelectedGrant = (props: ModeratorAdminWorkspaceProps & { grant: ModeratorAdminGrant | null }): React.ReactNode => {
  if (!props.grant) return null;
  const user = getUser(props.users, props.grant.userId);
  if (!user) return null;
  const protectedGrant = grantIsProtected(props.roles, props.grant);
  return <section className={styles.selectedGrant}><div><small>Selected grant</small><span><Avatar user={user} /><strong>{user.displayName}</strong></span></div><dl><div><dt>Role</dt><dd>{props.grant.roleName}</dd></div><div><dt>Trust</dt><dd>{trustLevelLabels[props.grant.trustLevel]}</dd></div><div><dt>Scope</dt><dd>{scopeLabels[props.grant.scopeKind]}</dd></div><div><dt>Availability</dt><dd>{availabilityLabels[props.grant.availability]}</dd></div><div><dt>Expires</dt><dd>{formatDate(props.grant.expiresAt)}</dd></div><div><dt>State</dt><dd>{props.grant.status}</dd></div></dl><span><button className={styles.iconButton} type="button" onClick={() => props.onEditGrant(props.grant!)} disabled={protectedGrant}><FiEdit2 /></button><button className={styles.danger} type="button" onClick={() => props.onRevokeGrant(props.grant!)} disabled={protectedGrant}>Revoke</button></span></section>;
};

const RankSetup = (props: ModeratorAdminWorkspaceProps): React.ReactNode => {
  const path = props.rankPaths.find((candidate) => candidate.id === props.selectedRankPathId) ?? props.rankPaths[0] ?? null;
  const pathRoles = path ? getPathRoles(props.roles, path.id) : [];
  const protectedPath = rankPathIsProtectedForEditing(props.roles, path?.id);
  const selectedRole = props.selectedRoleId
    ? props.roles.find((role) => role.id === props.selectedRoleId) ?? null
    : null;
  const permissions = useMemo(() => [...new Set([
    ...Object.keys(permissionLabels),
    ...(selectedRole?.permissions ?? [])
  ])].filter((permission) => permission !== "*"), [selectedRole]);
  const selectedGrant = props.grants.find((grant) => grant.id === props.editingGrantId) ?? props.grants.find((grant) => grant.status === "active" && !grantIsProtected(props.roles, grant)) ?? props.grants.find((grant) => grant.status === "active") ?? null;
  const visiblePathRoles = pathRoles.slice(0, 3);
  const reservedPathRoles = pathRoles.slice(3);
  const finalRole = pathRoles.at(-1) ?? null;
  const finalNextRole = props.roles.find((role) => role.id === finalRole?.nextRoleId) ?? null;
  return <div className={styles.rankLayout}>
    <PathRail {...props} />
    <main className={styles.detail}>
      <div className={styles.titleRow}><span><h2>{path?.name ?? "Rank"} path</h2><p>{path?.description ?? "Reusable ranks and promotion steps."}</p></span>{path ? <button className={styles.linkButton} type="button" disabled={protectedPath} onClick={() => props.onEditPath(path)}>Edit path</button> : null}</div>
      <PromotionTrack pathRoles={pathRoles} roles={props.roles} selectedRole={selectedRole} />
      <p className={styles.trackNote}>Each rank points to its next allowed promotion.</p>
      <div className={styles.headingRow}><h2>Ranks in this path</h2><button className={styles.textButton} type="button" onClick={props.onNewRole}><FiPlus /> New rank</button></div>
      <div className={styles.rankTable}><div className={styles.tableHead}><span>Rank</span><span>Rights</span><span>Next</span><span /></div>{visiblePathRoles.map((role) => <button key={role.id} type="button" className={role.id === selectedRole?.id ? styles.selected : ""} onClick={() => props.onSelectRole(role)}><strong>{role.name}</strong><span>{role.isOwnerRank ? "All rights" : `${role.permissions.length} rights`}</span><span>{props.roles.find((candidate) => candidate.id === role.nextRoleId)?.name ?? "End of path"}</span><FiChevronRight /></button>)}{reservedPathRoles.length > 0 ? <details className={styles.reservedRanks} open={reservedPathRoles.some((role) => role.id === selectedRole?.id) || undefined}><summary><strong>{path?.name ?? "Rank"} lvl {reservedPathRoles[0]?.rankLevel ?? 4}–{finalRole?.rankLevel ?? 10}</strong><span>reserved rights</span><span>{finalNextRole ? `ends at ${finalNextRole.name}` : "End of path"}</span><FiChevronRight /></summary><div>{reservedPathRoles.map((role) => <button key={role.id} type="button" className={role.id === selectedRole?.id ? styles.selected : ""} onClick={() => props.onSelectRole(role)}><strong>{role.name}</strong><span>{role.isOwnerRank ? "All rights" : `${role.permissions.length} rights`}</span><span>{props.roles.find((candidate) => candidate.id === role.nextRoleId)?.name ?? "End of path"}</span><FiChevronRight /></button>)}</div></details> : null}</div>
      <div className={styles.headingRow}><h2>Rights — {selectedRole?.name ?? (props.roleForm.id ? "Select a rank" : "New rank")}</h2></div>
      <RightsMatrix role={selectedRole} permissionText={props.roleForm.permissions} options={permissions} busy={props.busy} setRoleForm={props.setRoleForm} />
    </main>
    {props.canManageRanks ? props.rankEditorMode === "path" ? <PathEditor {...props} /> : <RoleEditor {...props} selectedRole={selectedRole} /> : <aside className={styles.editor}><div className={styles.lockNote}><FiLock /> Rank editing requires owner access.</div></aside>}
    <SelectedGrant {...props} grant={selectedGrant} />
  </div>;
};

const GrantEditor = (props: ModeratorAdminWorkspaceProps): React.ReactNode => {
  const grantableRoles = props.roles.filter((role) => role.grantable && !roleIsProtectedForEditing(role));
  return <form className={styles.editor} onSubmit={props.onSaveGrant}>
    <div className={styles.headingRow}><h2>{props.editingGrantId ? "Edit grant" : "Add grant"}</h2>{props.editingGrantId ? <button className={styles.iconButton} type="button" onClick={props.onCancelGrant}><FiX /></button> : null}</div>
    <label>Person<select value={props.grantForm.targetUserId} disabled={Boolean(props.editingGrantId)} onChange={(event) => props.setGrantForm((current) => ({ ...current, targetUserId: event.target.value }))}>{props.users.map((user) => <option key={user.id} value={user.id}>{user.displayName}{user.authEmail ? ` · ${user.authEmail}` : ""}</option>)}</select></label>
    <label>Role<select value={props.grantForm.roleId} disabled={Boolean(props.editingGrantId)} onChange={(event) => props.setGrantForm((current) => ({ ...current, roleId: event.target.value }))}>{grantableRoles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>
    <label>Trust level<select value={props.grantForm.trustLevel} onChange={(event) => props.setGrantForm((current) => ({ ...current, trustLevel: event.target.value as GrantableModeratorTrustLevel }))}>{grantableModeratorTrustLevels.map((level) => <option key={level} value={level}>{trustLevelLabels[level]}</option>)}</select></label>
    <label>Scope<select value={props.grantForm.scopeKind} onChange={(event) => props.setGrantForm((current) => ({ ...current, scopeKind: event.target.value as ModeratorGrantScopeKind, scopeId: "" }))}>{moderatorGrantScopeKinds.map((scope) => <option key={scope} value={scope}>{scopeLabels[scope]}</option>)}</select></label>
    <label>Scope ID<input value={props.grantForm.scopeId} disabled={props.grantForm.scopeKind === "global"} onChange={(event) => props.setGrantForm((current) => ({ ...current, scopeId: event.target.value }))} maxLength={191} /></label>
    <label>Availability<select value={props.grantForm.availability} onChange={(event) => props.setGrantForm((current) => ({ ...current, availability: event.target.value as ModeratorGrantAvailability }))}>{moderatorGrantAvailabilities.map((availability) => <option key={availability} value={availability}>{availabilityLabels[availability]}</option>)}</select><small>Use Live only for help that is needed while streaming.</small></label>
    <label>Expires<input type="datetime-local" value={props.grantForm.expiresAt} onChange={(event) => props.setGrantForm((current) => ({ ...current, expiresAt: event.target.value }))} /></label>
    <label>Reason<textarea rows={3} value={props.grantForm.reason} placeholder="Why is this changing?" onChange={(event) => props.setGrantForm((current) => ({ ...current, reason: event.target.value }))} maxLength={280} /></label>
    <span className={styles.formActions}><button className={styles.primary} type="submit" disabled={props.busy}>{props.busy ? "Saving…" : props.editingGrantId ? "Save grant" : "Add grant"}</button>{props.editingGrantId ? <button type="button" onClick={props.onCancelGrant}>Cancel</button> : null}</span>
    <div className={styles.lockNote}><FiLock /> Owner/admin assignment and dangerous capabilities stay owner-only.</div>
  </form>;
};

const AuditList = ({ logs }: { logs: readonly ModeratorAdminAuditLog[] }): React.ReactNode => <section className={styles.audit} id="grant-audit"><div className={styles.headingRow}><h2>Recent grant audit</h2><span>{logs.length}</span></div>{logs.length === 0 ? <p className={styles.empty}>No grant changes recorded.</p> : logs.slice(0, 8).map((log) => <div key={log.id}><strong>{actionLabels[log.action]} {log.roleName ?? log.roleId}</strong><span>{log.targetDisplayName ?? log.targetUserId}</span><span>{log.actorDisplayName ?? "system"}</span><time>{formatDate(log.createdAt)}</time></div>)}</section>;

const GrantsView = (props: ModeratorAdminWorkspaceProps): React.ReactNode => {
  const [query, setQuery] = useState("");
  const selectedUser = getUser(props.users, props.selectedUserId);
  const userGrants = props.grants.filter((grant) => grant.userId === props.selectedUserId);
  return <div className={styles.grantsLayout}>
    <aside className={styles.rail}><div className={styles.headingRow}><h2>Grant recipients</h2><span>{props.users.length}</span></div><label className={styles.search}><FiSearch /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a person" /></label><div className={styles.people}>{props.users.filter((user) => `${user.displayName} ${user.authEmail ?? ""}`.toLowerCase().includes(query.toLowerCase())).map((user) => { const active = props.grants.find((grant) => grant.userId === user.id && grant.status === "active"); return <button key={user.id} type="button" className={user.id === props.selectedUserId ? styles.selected : ""} onClick={() => props.onSelectUser(user.id)}><Avatar user={user} /><span><strong>{user.displayName}</strong><small>{active?.roleName ?? "No helper grant"}</small></span><i data-tone={active ? "mint" : "muted"} /></button>; })}</div></aside>
    <main className={styles.detail}><div className={styles.titleRow}><span><h2>{selectedUser?.displayName ?? "Select a person"}</h2><p>{selectedUser?.authEmail ?? "Current helper and moderator access."}</p></span><button className={styles.primary} type="button" onClick={() => props.onNewGrant(selectedUser?.id)}>Add grant</button></div><div className={styles.grantTable}><div className={styles.grantHead}><span>Role</span><span>Trust</span><span>Scope</span><span>Available</span><span>Expires</span><span>State</span><span /></div>{userGrants.length === 0 ? <p className={styles.empty}>No grants for this person.</p> : userGrants.map((grant) => { const protectedGrant = grantIsProtected(props.roles, grant); return <div className={styles.grantRow} key={grant.id}><strong>{grant.roleName}</strong><span>{trustLevelLabels[grant.trustLevel]}</span><span>{scopeLabels[grant.scopeKind]}</span><span>{availabilityLabels[grant.availability]}</span><span>{formatDate(grant.expiresAt)}</span><span>{grant.status}</span><span><button className={styles.iconButton} type="button" disabled={protectedGrant} onClick={() => props.onEditGrant(grant)}><FiEdit2 /></button><button className={styles.danger} type="button" disabled={protectedGrant || grant.status === "revoked"} onClick={() => props.onRevokeGrant(grant)}>Revoke</button></span></div>; })}</div><AuditList logs={props.auditLogs.filter((log) => log.targetUserId === props.selectedUserId)} /></main>
    <GrantEditor {...props} />
  </div>;
};

export const ModeratorAdminWorkspace = (props: ModeratorAdminWorkspaceProps): React.ReactNode => {
  const [search, setSearch] = useState("");
  const matchingRole = search.trim() ? props.roles.find((role) => `${role.name} ${role.permissions.join(" ")}`.toLowerCase().includes(search.toLowerCase())) : null;
  return <div className={styles.page}>
    <header className={styles.pageHeader}><div><p>Owner admin</p><h1>Moderators</h1><span>Ranks, rights and access grants</span></div><div><label className={styles.search}><FiSearch /><input value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && matchingRole) { event.preventDefault(); props.onSelectRole(matchingRole); props.onViewChange("ranks"); } }} placeholder="Find a rank or right" /></label><button className={styles.primary} type="button" onClick={props.onNewRole} disabled={!props.canManageRanks}><FiPlus /> New rank</button></div></header>
    <nav className={styles.tabs}><button type="button" className={props.view === "grants" ? styles.selected : ""} onClick={() => props.onViewChange("grants")}>Grants</button><button type="button" className={props.view === "ranks" ? styles.selected : ""} onClick={() => props.onViewChange("ranks")}>Rank setup</button><button type="button" className={styles.auditLink} onClick={() => props.onViewChange("grants")}>Grant audit</button></nav>
    {props.message !== "Moderator admin loaded." ? <div className={styles.status} role="status">{props.message}</div> : null}
    {props.view === "ranks" ? <RankSetup {...props} /> : <GrantsView {...props} />}
  </div>;
};
