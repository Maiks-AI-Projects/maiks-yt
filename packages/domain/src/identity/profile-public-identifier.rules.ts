import {
  isAssignableReservedProfileHandle,
  isCanonicalProfileHandle,
  isReservedProfileHandle
} from "./profile-handle-normalization.rules.js";

const unsafeOpaqueIdentifierPattern = /[/%\\?#.]/u;
const uuidLikePattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;
const compactUuidLikePattern = /^[0-9a-f]{32}$/iu;
const numericIdentifierPattern = /^\d+$/u;
const rawIdentifierPattern = /^(?:account|auth|provider|user)(?:[-_]?id)?[-_][A-Za-z0-9_-]+$/iu;
const opaqueProfileImageIdentifierBrand: unique symbol = Symbol("OpaqueProfileImageIdentifier");

export type OpaqueProfileImageIdentifier = Readonly<{
  value: string;
  [opaqueProfileImageIdentifierBrand]: true;
}>;

const allowsPublicRouteHandle = (handle: string): boolean =>
  !isReservedProfileHandle(handle) || isAssignableReservedProfileHandle(handle);

export const buildProfileRoutePath = (handle: string): string | null =>
  isCanonicalProfileHandle(handle) && allowsPublicRouteHandle(handle) ? `/profiles/${handle}` : null;

export const buildHandleBasedProfileImageRoutePath = (handle: string): string | null =>
  isCanonicalProfileHandle(handle) && allowsPublicRouteHandle(handle) ? `/profiles/${handle}/image` : null;

export const createOpaqueProfileImageIdentifierFromTrustedSource = (
  identifier: string
): OpaqueProfileImageIdentifier | null => {
  // Shape checks limit accidental leaks. The caller remains responsible for trusted token provenance.
  if (
    identifier.length < 16
    || identifier.length > 128
    || uuidLikePattern.test(identifier)
    || compactUuidLikePattern.test(identifier)
    || numericIdentifierPattern.test(identifier)
    || rawIdentifierPattern.test(identifier)
    || unsafeOpaqueIdentifierPattern.test(identifier)
    || !/^[A-Za-z0-9_-]+$/u.test(identifier)
  ) {
    return null;
  }

  return Object.freeze({
    value: identifier,
    [opaqueProfileImageIdentifierBrand]: true as const
  });
};
