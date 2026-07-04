export type DevOwnerTokenMintInput = {
  label: string;
  path: string;
  ttlMinutes: number;
};

export type DevOwnerTokenMintRequest = {
  label?: string | undefined;
  path?: string | undefined;
  ttlMinutes?: number | undefined;
};

export type DevOwnerTokenOwner = {
  authUserId: string;
  domainUserId: string;
};

export type DevOwnerTokenInsertInput = {
  id: string;
  label: string;
  tokenHash: string;
  authUserId: string;
  expiresAt: Date;
};

export type DevOwnerTokenRepository = {
  findOwnerAuthUser(): Promise<DevOwnerTokenOwner | null>;
  insertToken(input: DevOwnerTokenInsertInput): Promise<void>;
};

export type DevOwnerTokenMintResult =
  | {
    ok: true;
    expiresAt: string;
    loginUrl: string;
    token: string;
  }
  | {
    ok: false;
    reason:
      | "dev_owner_token_disabled"
      | "dev_owner_token_secret_missing"
      | "dev_owner_token_forbidden"
      | "dev_owner_token_invalid_input"
      | "dev_owner_token_owner_missing";
  };
