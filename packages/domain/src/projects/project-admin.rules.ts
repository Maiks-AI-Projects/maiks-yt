import type {
  ProjectAdminCapability,
  ProjectAdminItemInput,
  ProjectAdminItemLinkInput,
  ProjectAdminMilestoneInput,
  ProjectAdminProjectInput,
  ProjectAdminPublicPreviewResult,
  ProjectAdminUpdateInput
} from "./project-admin.types.js";
import type { ProjectReadModelSource } from "./project-read-model.types.js";
import { buildPublicProjectDetail } from "./project-read-model.rules.js";

export const projectAdminTitleMaxLength = 191;
export const projectAdminSummaryMaxLength = 2_000;
export const projectAdminDescriptionMaxLength = 2_000;
export const projectAdminUpdateSummaryMaxLength = 280;
export const projectAdminUpdateBodyMaxLength = 10_000;
export const projectAdminEstimateMinorAmountMax = 2_147_483_647;
export const projectAdminItemLinkProviderMaxLength = 80;
export const projectAdminItemLinkUrlMaxLength = 1_024;
export const projectAdminItemLinkLabelMaxLength = 191;

const projectSlugPattern = /^[a-z0-9][a-z0-9-]{0,190}$/;
const currencyCodePattern = /^[A-Z]{3}$/;

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
  && isValidEstimate(input.estimatedMinorAmount ?? null, input.currencyCode ?? null)
  && Number.isInteger(input.sortOrder)
  && input.sortOrder >= 0;

export const isValidProjectAdminItemLinkInput = (
  input: ProjectAdminItemLinkInput
): boolean =>
  isValidProjectAdminText(input.provider, projectAdminItemLinkProviderMaxLength)
  && isValidProjectAdminText(input.label, projectAdminItemLinkLabelMaxLength)
  && isValidProjectAdminItemLinkUrl(input.url)
  && ["store-product", "wishlist-entry", "reference", "receipt"].includes(input.relationship);

const isValidProjectAdminItemLinkUrl = (value: string): boolean => {
  if (value.trim().length === 0 || value.trim().length > projectAdminItemLinkUrlMaxLength) {
    return false;
  }

  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
};

const isValidEstimate = (
  estimatedMinorAmount: number | null,
  currencyCode: string | null
): boolean => {
  if (estimatedMinorAmount === null && currencyCode === null) {
    return true;
  }

  return typeof estimatedMinorAmount === "number"
    && Number.isInteger(estimatedMinorAmount)
    && estimatedMinorAmount >= 0
    && estimatedMinorAmount <= projectAdminEstimateMinorAmountMax
    && typeof currencyCode === "string"
    && currencyCodePattern.test(currencyCode);
};

export const isValidProjectAdminUpdateInput = (
  input: ProjectAdminUpdateInput
): boolean =>
  isValidProjectAdminText(input.title)
  && isValidOptionalText(input.summary, projectAdminUpdateSummaryMaxLength)
  && isValidProjectAdminText(input.body, projectAdminUpdateBodyMaxLength)
  && Number.isInteger(input.sortOrder)
  && input.sortOrder >= 0
  && (input.publishedAt === undefined
    || input.publishedAt === null
    || !Number.isNaN(Date.parse(input.publishedAt)));

export const buildProjectAdminPublicPreview = (
  project: ProjectReadModelSource
): ProjectAdminPublicPreviewResult => {
  const previewProject = buildPublicProjectDetail({
    ...project,
    isPublic: true
  });

  return previewProject
    ? {
      ok: true,
      project: previewProject
    }
    : {
      ok: false,
      reason: "project_admin_preview_unavailable_status"
    };
};
