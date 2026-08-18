export type MusicAuthUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export type MusicAuthSession = {
  user: MusicAuthUser;
} | null;

export type MusicActor = {
  domainUserId: string;
  rolePermissionValues: readonly unknown[];
};
