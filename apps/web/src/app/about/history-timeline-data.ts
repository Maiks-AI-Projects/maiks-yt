import { personalTimeline } from "./personal-timeline-data";
import { residenceTimeline } from "./residence-timeline-data";

export type HistoryTimelineEntry = {
  age?: number;
  date: string;
  dateTime: string;
  description: string;
  id: string;
  kind: "birth" | "birthday" | "residence" | "streaming";
  title: string;
  year: number;
};

const birthYear = 1986;
const birthMonthIndex = 7;
const birthDay = 20;

const ageAtDate = (dateTime: string): number => {
  const date = new Date(`${dateTime}T00:00:00Z`);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const birthdayHasPassed = month > birthMonthIndex + 1 || (month === birthMonthIndex + 1 && day >= birthDay);

  return year - birthYear - (birthdayHasPassed ? 0 : 1);
};

const ordinal = (value: number): string => {
  const lastTwoDigits = value % 100;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) {
    return `${value}th`;
  }

  switch (value % 10) {
    case 1:
      return `${value}st`;
    case 2:
      return `${value}nd`;
    case 3:
      return `${value}rd`;
    default:
      return `${value}th`;
  }
};

export const createHistoryTimeline = (now: Date = new Date()): readonly HistoryTimelineEntry[] => {
  const currentYear = now.getFullYear();
  const birthdayThisYear = new Date(currentYear, birthMonthIndex, birthDay);
  const lastCompletedBirthdayYear = now < birthdayThisYear ? currentYear - 1 : currentYear;
  const entries: HistoryTimelineEntry[] = [
    {
      age: 0,
      date: "20 August 1986",
      dateTime: "1986-08-20",
      description: "Michael was born in Vught, the Netherlands.",
      id: "birth-1986",
      kind: "birth",
      title: "Born",
      year: birthYear
    }
  ];

  for (let year = birthYear + 1; year <= lastCompletedBirthdayYear; year += 1) {
    const age = year - birthYear;
    entries.push({
      age,
      date: `20 August ${year}`,
      dateTime: `${year}-08-20`,
      description: `Age ${age}.`,
      id: `birthday-${year}`,
      kind: "birthday",
      title: `${ordinal(age)} birthday`,
      year
    });
  }

  entries.push(
    ...residenceTimeline.map((entry) => {
      const age = ageAtDate(entry.dateTime);

      return {
        ...entry,
        age,
        description: `Age ${age}. ${entry.description}`,
        kind: "residence" as const
      };
    })
  );

  entries.push(...personalTimeline);

  return entries.sort((left, right) => left.dateTime.localeCompare(right.dateTime));
};
