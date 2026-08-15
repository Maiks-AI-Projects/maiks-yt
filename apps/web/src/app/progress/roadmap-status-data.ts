export type RoadmapStatus = "usable" | "partial" | "building" | "planned" | "later";

export const roadmapStatusLabels: Readonly<Record<RoadmapStatus, string>> = {
  usable: "Usable now",
  partial: "Partial",
  building: "Building now",
  planned: "Planned",
  later: "Later"
};
