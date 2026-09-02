export type ScheduleFormError = {
  field: "global" | "title" | "startsAt" | "endsAt" | "channelKey";
  message: string;
};

const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const militaryTimePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const localDateTimePattern = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d$/;

export const normalizeScheduleKey = (value: string): string => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .trim()
  .toLocaleLowerCase("en")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")
  .slice(0, 80);

export const splitLocalDateTime = (value: string): { date: string; time: string } => {
  if (!localDateTimePattern.test(value)) return { date: "", time: "" };
  const [date = "", time = ""] = value.split("T");
  return { date, time };
};

export const combineLocalDateAndTime = (date: string, time: string): string =>
  localDatePattern.test(date) && militaryTimePattern.test(time) ? `${date}T${time}` : "";

export const validateScheduleTimeRange = (
  startsAt: string,
  endsAt: string
): ScheduleFormError[] => {
  const errors: ScheduleFormError[] = [];

  if (!localDateTimePattern.test(startsAt) || Number.isNaN(Date.parse(startsAt))) {
    errors.push({ field: "startsAt", message: "Choose a valid start date and enter the time as HH:MM, for example 21:00." });
  }

  if (endsAt && (!localDateTimePattern.test(endsAt) || Number.isNaN(Date.parse(endsAt)))) {
    errors.push({ field: "endsAt", message: "Choose a valid end date and enter the time as HH:MM, for example 23:30." });
  }

  if (errors.length === 0 && endsAt && Date.parse(endsAt) <= Date.parse(startsAt)) {
    const endTime = splitLocalDateTime(endsAt).time;
    errors.push({
      field: "endsAt",
      message: endTime === "00:00"
        ? "00:00 is the beginning of the selected date. If you mean midnight after the stream, choose the next date."
        : "The end must be later than the start. If the stream ends after midnight, choose the next date."
    });
  }

  return errors;
};

export const validateScheduleForm = (input: {
  title: string;
  startsAt: string;
  endsAt: string;
  channelRefs: readonly string[];
}): ScheduleFormError[] => {
  const errors: ScheduleFormError[] = [];

  if (!input.title.trim()) errors.push({ field: "title", message: "Enter a stream title." });
  errors.push(...validateScheduleTimeRange(input.startsAt, input.endsAt));
  if (input.channelRefs.length === 0) errors.push({ field: "channelKey", message: "Choose at least one connected Twitch or YouTube channel." });

  return errors;
};
