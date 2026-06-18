import type {
  ProjectAdminCapability,
  ProjectAdminItemInput,
  ProjectAdminMilestoneInput,
  ProjectAdminProjectInput
} from "./project-admin.types.js";

export const projectAdminTitleMaxLength = 191;
export const projectAdminSummaryMaxLength = 2_000;
export const projectAdminDescriptionMaxLength = 2_000;

const projectSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;

export const canManageProjects = (capabilities: readonly unknown[]): boolean =>
  capabilities.some((capability): capability is ProjectAdminCapability =>
    capability === "*" || capability === "project-admin:manage"
  );

export const isValidProjectAdminSlug = (slug: string): boolean =>
  projectSlugPattern.test(slug);

export const isValidProjectAdminText = (
  value: unknown,
  maxLength = projectAdminTitleMaxLength
): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.trim().length <= maxLength;

const isValidOptionalText = (value: unknown, maxLength: number): boolean =>
  value === undefined
    || value === null
    || (typeof value === "string" && value.trim().length <= maxLength);

export const isValidProjectAdminProjectInput = (
  input: ProjectAdminProjectInput
): boolean =>
  isValidProjectAdminSlug(input.slug)
  && isValidProjectAdminText(input.title)
  && isValidOptionalText(input.summary, projectAdminSummaryMaxLength);

export const isValidProjectAdminMilestoneInput = (
  input: ProjectAdminMilestoneInput
): boolean =>
  isValidProjectAdminText(input.title)
  && isValidOptionalText(input.description, projectAdminDescriptionMaxLength)
  && Number.isInteger(input.sortOrder)
  && input.sortOrder >= 0;

export const isValidProjectAdminItemInput = (
  input: ProjectAdminItemInput
): boolean =>
  isValidProjectAdminText(input.title)
  && isValidOptionalText(input.description, projectAdminDescriptionMaxLength)
  && Number.isInteger(input.quantity)
  && input.quantity >= 1
  && Number.isInteger(input.sortOrder)
  && input.sortOrder >= 0;
