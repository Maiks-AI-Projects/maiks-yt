import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
  type TestRendererOptions
} from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  emptyForm,
  type ModeratorAdminAuditLog,
  type ModeratorAdminGrant,
  type ModeratorAdminRole,
  type ModeratorAdminUser,
  type RoleFormState
} from "./moderator-admin-client.service";
import {
  ModeratorAdminWorkspace,
  type ModeratorAdminWorkspaceProps
} from "./moderator-admin-panels";

const now = "2026-08-28T12:00:00.000Z";

const createRole = (overrides: Partial<ModeratorAdminRole> = {}): ModeratorAdminRole => ({
  id: "role-1",
  key: "community-helper",
  name: "Community helper",
  permissions: ["chat:view"],
  rankPathId: "mod-path",
  rankPathKey: "mod",
  rankPathName: "Moderator",
  rankLevel: 1,
  displayLabel: null,
  nextRoleId: null,
  discordRoleId: null,
  isOwnerRank: false,
  isSystem: false,
  authorityIntegrity: "valid",
  grantable: true,
  createdAt: now,
  updatedAt: now,
  ...overrides
});

const createUser = (overrides: Partial<ModeratorAdminUser> = {}): ModeratorAdminUser => ({
  id: "user-1",
  displayName: "Taylor",
  profileVisibility: "public",
  avatarUrl: null,
  authEmail: "taylor@example.test",
  createdAt: now,
  updatedAt: now,
  ...overrides
});

const createGrant = (overrides: Partial<ModeratorAdminGrant> = {}): ModeratorAdminGrant => ({
  id: "grant-1",
  userId: "user-1",
  roleId: "role-1",
  roleKey: "community-helper",
  roleName: "Community helper",
  rolePermissions: ["chat:view"],
  trustLevel: "helper",
  scopeKind: "global",
  scopeId: null,
  availability: "always",
  assignedByUserId: null,
  expiresAt: null,
  revokedAt: null,
  revokedByUserId: null,
  revocationReason: null,
  assignedAt: now,
  status: "active",
  ...overrides
});

const createAuditLog = (overrides: Partial<ModeratorAdminAuditLog> = {}): ModeratorAdminAuditLog => ({
  id: "audit-1",
  targetUserId: "user-1",
  targetDisplayName: "Taylor",
  roleId: "role-1",
  roleKey: "community-helper",
  roleName: "Community helper",
  actorUserId: null,
  actorDisplayName: null,
  action: "grant",
  reason: null,
  createdAt: now,
  ...overrides
});

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

const createProps = (
  role: ModeratorAdminRole,
  rankEditorMode: "role" | "path"
): ModeratorAdminWorkspaceProps => ({
  users: [],
  rankPaths: [{
    id: "mod-path",
    key: "mod",
    name: "Moderator",
    description: null,
    sortOrder: 10,
    createdAt: now,
    updatedAt: now
  }],
  roles: [role],
  grants: [],
  auditLogs: [],
  selectedUserId: "",
  selectedRankPathId: "mod-path",
  selectedRoleId: role.id,
  editingGrantId: null,
  view: "ranks",
  rankEditorMode,
  grantForm: emptyForm,
  rankPathForm: {
    id: "mod-path",
    key: "mod",
    name: "Moderator",
    description: "",
    sortOrder: "10"
  },
  roleForm: getRoleForm(role),
  busy: false,
  message: "Moderator admin loaded.",
  canManageRanks: true,
  onViewChange: vi.fn(),
  onSelectUser: vi.fn(),
  onSelectRankPath: vi.fn(),
  onSelectRole: vi.fn(),
  onNewGrant: vi.fn(),
  onEditGrant: vi.fn(),
  onRevokeGrant: vi.fn(),
  onSaveGrant: vi.fn(),
  onCancelGrant: vi.fn(),
  onNewPath: vi.fn(),
  onEditPath: vi.fn(),
  onSavePath: vi.fn(),
  onDeletePath: vi.fn(),
  onNewRole: vi.fn(),
  onSaveRole: vi.fn(),
  onDeleteRole: vi.fn(),
  onCancelRole: vi.fn(),
  setGrantForm: vi.fn(),
  setRankPathForm: vi.fn(),
  setRoleForm: vi.fn()
});

const findButton = (root: ReactTestInstance, label: string): ReactTestInstance =>
  root.findAllByType("button").find((button) => button.children.includes(label))
  ?? (() => { throw new Error(`Button not found: ${label}`); })();

const getTextContent = (node: ReactTestInstance): string =>
  node.children.map((child) => typeof child === "string" ? child : getTextContent(child)).join(" ");

const renderWorkspace = async (
  props: ModeratorAdminWorkspaceProps,
  options?: TestRendererOptions
): Promise<ReactTestRenderer> => {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<ModeratorAdminWorkspace {...props} />, options);
  });
  if (!renderer) {
    throw new Error("Moderator workspace did not render.");
  }
  return renderer;
};

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("moderator admin protected edit affordances", () => {
  it("locks role edits for system, wildcard, and reserved-key ranks", async () => {
    for (const role of [
      createRole({ isSystem: true }),
      createRole({ permissions: ["*"] }),
      createRole({ key: "admin" }),
      createRole({
        key: "invalid-role-key",
        permissions: [],
        authorityIntegrity: "invalid",
        grantable: true
      })
    ]) {
      const renderer = await renderWorkspace(createProps(role, "role"));
      expect(findButton(renderer.root, "Save rank").props.disabled).toBe(true);
      expect(findButton(renderer.root, "Remove rank").props.disabled).toBe(true);
      expect(renderer.root.findAllByType("input").find((input) => input.props.value === role.name)?.props.disabled).toBe(true);
      await act(async () => renderer.unmount());
    }
  });

  it("keeps valid ordinary role editing available", async () => {
    const role = createRole();
    const renderer = await renderWorkspace(createProps(role, "role"));
    expect(findButton(renderer.root, "Save rank").props.disabled).toBe(false);
    expect(findButton(renderer.root, "Remove rank").props.disabled).toBe(false);
    expect(renderer.root.findAllByType("input").find((input) => input.props.value === role.name)?.props.disabled).toBe(false);
    await act(async () => renderer.unmount());
  });

  it("locks path editing when the path contains a protected rank", async () => {
    const renderer = await renderWorkspace(createProps(createRole({ permissions: ["*"] }), "path"));
    expect(findButton(renderer.root, "Edit path").props.disabled).toBe(true);
    expect(findButton(renderer.root, "Save path").props.disabled).toBe(true);
    expect(findButton(renderer.root, "Remove path").props.disabled).toBe(true);
    await act(async () => renderer.unmount());
  });
});

describe("moderator admin hygiene", () => {
  it("keeps dormant Discord mappings out of the role editor", async () => {
    const discordRoleId = "discord-role-123";
    const renderer = await renderWorkspace(createProps(createRole({ discordRoleId }), "role"));
    const text = getTextContent(renderer.root);

    expect(text).not.toContain("Discord role ID");
    expect(text).not.toContain("Future mapping only");
    expect(renderer.root.findAllByType("input").some((input) => input.props.value === discordRoleId)).toBe(false);
    await act(async () => renderer.unmount());
  });

  it("uses readable audit fallbacks without exposing role or user IDs", async () => {
    const targetUserId = "target-user-secret";
    const unresolvedActorId = "actor-user-secret";
    const props = {
      ...createProps(createRole(), "role"),
      users: [createUser({ id: targetUserId })],
      selectedUserId: targetUserId,
      view: "grants" as const,
      auditLogs: [
        createAuditLog({
          id: "audit-unresolved",
          targetUserId,
          targetDisplayName: null,
          roleId: "role-secret",
          roleKey: null,
          roleName: null,
          actorUserId: unresolvedActorId,
          actorDisplayName: null
        }),
        createAuditLog({
          id: "audit-system",
          targetUserId,
          targetDisplayName: null,
          roleId: "other-role-secret",
          roleKey: null,
          roleName: null,
          actorUserId: null,
          actorDisplayName: null
        })
      ]
    };
    const renderer = await renderWorkspace(props);
    const text = getTextContent(renderer.root);

    expect(text).toContain("Unknown role");
    expect(text).toContain("Unknown user");
    expect(text).toContain("Unknown actor");
    expect(text).toContain("System");
    expect(text).not.toContain("role-secret");
    expect(text).not.toContain("other-role-secret");
    expect(text).not.toContain(targetUserId);
    expect(text).not.toContain(unresolvedActorId);
    await act(async () => renderer.unmount());
  });

  it("focuses the grant audit after navigation and when already viewing grants", async () => {
    const focusAudit = vi.fn();
    const props = createProps(createRole(), "role");
    const renderer = await renderWorkspace(props, {
      createNodeMock: (element) => {
        const elementProps = element.props;
        return element.type === "section"
          && typeof elementProps === "object"
          && elementProps !== null
          && "id" in elementProps
          && elementProps.id === "grant-audit"
          ? { focus: focusAudit }
          : {};
      }
    });
    const auditButton = findButton(renderer.root, "Grant audit");

    expect(auditButton.props.type).toBe("button");
    await act(async () => auditButton.props.onClick());
    expect(props.onViewChange).toHaveBeenCalledWith("grants");
    expect(focusAudit).not.toHaveBeenCalled();

    await act(async () => {
      renderer.update(<ModeratorAdminWorkspace {...props} view="grants" />);
    });
    expect(focusAudit).toHaveBeenCalledTimes(1);

    await act(async () => findButton(renderer.root, "Grant audit").props.onClick());
    expect(focusAudit).toHaveBeenCalledTimes(2);
    await act(async () => renderer.unmount());
  });

  it("names icon-only grant edit and cancel actions", async () => {
    const user = createUser();
    const grant = createGrant();
    const baseProps = {
      ...createProps(createRole(), "role"),
      users: [user],
      grants: [grant],
      selectedUserId: user.id,
      grantForm: { ...emptyForm, targetUserId: user.id, roleId: grant.roleId }
    };
    const grantsRenderer = await renderWorkspace({
      ...baseProps,
      view: "grants",
      editingGrantId: grant.id
    });

    expect(grantsRenderer.root.findAllByType("button").filter((button) => button.props["aria-label"] === "Edit grant")).toHaveLength(1);
    expect(grantsRenderer.root.findAllByType("button").filter((button) => button.props["aria-label"] === "Cancel grant editing")).toHaveLength(1);
    await act(async () => grantsRenderer.unmount());

    const ranksRenderer = await renderWorkspace(baseProps);
    expect(ranksRenderer.root.findAllByType("button").filter((button) => button.props["aria-label"] === "Edit grant")).toHaveLength(1);
    await act(async () => ranksRenderer.unmount());
  });
});
