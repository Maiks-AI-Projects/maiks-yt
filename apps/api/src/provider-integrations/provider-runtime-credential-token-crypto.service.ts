import {
  createAuthDataCipherFromEnvironment,
  type AuthDataCipher
} from "../auth/auth-sensitive-field-crypto.service.js";

const credentialModel = "providerRuntimeCredential";

export type ProviderRuntimeCredentialTokens = {
  accessToken: string | null;
  refreshToken: string | null;
};

const transformToken = (
  value: string | null,
  field: "accessToken" | "refreshToken",
  cipher: AuthDataCipher | null,
  direction: "encrypt" | "decrypt"
): string | null => {
  if (value === null || !cipher) {
    return value;
  }

  return direction === "encrypt"
    ? cipher.encrypt({ model: credentialModel, field, plaintext: value })
    : cipher.decrypt({ model: credentialModel, field, storedValue: value });
};

export const protectProviderRuntimeCredentialTokens = (
  tokens: ProviderRuntimeCredentialTokens,
  cipher: AuthDataCipher | null
): ProviderRuntimeCredentialTokens => ({
  accessToken: transformToken(tokens.accessToken, "accessToken", cipher, "encrypt"),
  refreshToken: transformToken(tokens.refreshToken, "refreshToken", cipher, "encrypt")
});

export const revealProviderRuntimeCredentialTokens = (
  tokens: ProviderRuntimeCredentialTokens,
  cipher: AuthDataCipher | null
): ProviderRuntimeCredentialTokens => ({
  accessToken: transformToken(tokens.accessToken, "accessToken", cipher, "decrypt"),
  refreshToken: transformToken(tokens.refreshToken, "refreshToken", cipher, "decrypt")
});

export const createProviderRuntimeCredentialCipherFromEnvironment = (): AuthDataCipher | null =>
  createAuthDataCipherFromEnvironment();
