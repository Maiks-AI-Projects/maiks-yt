export type PersonalTimelineEntry = {
  date: string;
  dateTime: string;
  description: string;
  id: string;
  kind: "streaming";
  title: string;
  year: number;
};

export const personalTimeline: readonly PersonalTimelineEntry[] = [
  {
    date: "2025",
    dateTime: "2025",
    description: "I stopped streaming while undergoing therapy.",
    id: "streaming-stopped-2025",
    kind: "streaming",
    title: "Stopped streaming for treatment",
    year: 2025
  }
] as const;
