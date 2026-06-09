export type MilestoneStatus = "planned" | "active" | "completed" | "cancelled";

export type Milestone = {
  id: string;
  title: string;
  status: MilestoneStatus;
};
