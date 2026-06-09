import type { Milestone } from "./milestone.types.js";
import type { ProjectCategory } from "./project-category.types.js";

export type ProjectType =
  | "one-time-purchase"
  | "multi-item-build"
  | "ongoing-cost"
  | "subscription"
  | "stream-work-project"
  | "milestone-only";

export type ProjectStatus = "planning" | "active" | "completed" | "mothballed" | "cancelled";

export type Project = {
  id: string;
  title: string;
  type: ProjectType;
  category: ProjectCategory;
  status: ProjectStatus;
  milestones: readonly Milestone[];
};
