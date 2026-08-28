import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  emptyForm,
  type ModeratorAdminRole,
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

const renderWorkspace = async (props: ModeratorAdminWorkspaceProps): Promise<ReactTestRenderer> => {
  let renderer: ReactTestRenderer | null = null;
  await act(async () => {
    renderer = create(<ModeratorAdminWorkspace {...props} />);
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
