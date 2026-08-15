export type HealthTimelineMetric = {
  label: string;
  value: string;
};

export type HealthTimelineEntry = {
  metrics: readonly HealthTimelineMetric[];
  summary: string;
  title: string;
  year: number;
};

export const healthTimeline: readonly HealthTimelineEntry[] = [
  {
    year: 2014,
    title: "Broken right hand",
    summary: "I broke a bone in my right hand. Follow-up imaging showed that it was healing.",
    metrics: [
      { value: "2", label: "documented hand X-rays" },
      { value: "1", label: "confirmed fracture" }
    ]
  },
  {
    year: 2017,
    title: "The tumour and first operation",
    summary: "A low-grade brain tumour was discovered and surgically removed. Recovery left lasting effects on my energy, focus, planning, and tolerance for overstimulation.",
    metrics: [
      { value: "1+", label: "documented brain MRI" },
      { value: "2+", label: "laboratory collection dates" },
      { value: "1", label: "brain operation" }
    ]
  },
  {
    year: 2018,
    title: "Monitoring and a head injury",
    summary: "A head injury led to an emergency assessment. Imaging found no bleeding, and I returned home without being admitted.",
    metrics: [
      { value: "2", label: "brain MRI scans" },
      { value: "1", label: "CT scan" },
      { value: "1", label: "emergency assessment" }
    ]
  },
  {
    year: 2019,
    title: "Continued monitoring",
    summary: "Follow-up monitoring continued without a major event that needs a separate public explanation.",
    metrics: [
      { value: "1", label: "brain MRI scan" },
      { value: "1", label: "laboratory collection date" }
    ]
  },
  {
    year: 2020,
    title: "Continued monitoring",
    summary: "The available records show continued brain imaging during the year.",
    metrics: [{ value: "1", label: "brain MRI scan" }]
  },
  {
    year: 2021,
    title: "Continued monitoring",
    summary: "The available records show continued brain imaging during the year.",
    metrics: [{ value: "1", label: "brain MRI scan" }]
  },
  {
    year: 2022,
    title: "Changes on follow-up scans",
    summary: "Routine MRI monitoring showed slow change near the earlier surgical area, leading to renewed specialist review.",
    metrics: [
      { value: "1", label: "brain MRI scan" },
      { value: "1", label: "laboratory collection date" }
    ]
  },
  {
    year: 2023,
    title: "Second brain operation",
    summary: "I underwent repeat brain surgery on 11 April and stayed in hospital from 7 to 15 April. Recovery and my return to activity were deliberately gradual.",
    metrics: [
      { value: "3", label: "brain MRI scans" },
      { value: "2+", label: "laboratory collection dates" },
      { value: "1", label: "brain operation" },
      { value: "1", label: "documented hospital stay" }
    ]
  },
  {
    year: 2024,
    title: "Considering further treatment",
    summary: "A subtle change on an MRI led to discussion of additional treatment options.",
    metrics: [
      { value: "1", label: "brain MRI scan" },
      { value: "1+", label: "laboratory collection date" }
    ]
  },
  {
    year: 2025,
    title: "Daily treatment began",
    summary: "I started daily treatment in March and underwent frequent monitoring. The four documented brain MRI scans remained stable.",
    metrics: [
      { value: "4", label: "stable brain MRI scans" },
      { value: "18+", label: "laboratory collection dates" }
    ]
  },
  {
    year: 2026,
    title: "Stable follow-up on treatment",
    summary: "Treatment continued, with the three documented brain MRI scans through July remaining stable.",
    metrics: [
      { value: "3", label: "stable brain MRI scans" },
      { value: "7+", label: "laboratory collection dates through July" }
    ]
  }
] as const;
