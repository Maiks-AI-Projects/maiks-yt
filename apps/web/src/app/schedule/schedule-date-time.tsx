"use client";

import { useEffect, useState } from "react";

type ScheduleDateTimeProps = {
  endsAt: string | null;
  startsAt: string;
};

const formatRange = (
  startsAt: string,
  endsAt: string | null,
  locale?: string,
  timeZone?: string
): string => {
  const dateFormatter = new Intl.DateTimeFormat(locale, {
    dateStyle: "full",
    ...(timeZone ? { timeZone } : {})
  });
  const timeFormatter = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {})
  });
  const start = new Date(startsAt);
  const date = dateFormatter.format(start);
  const startTime = timeFormatter.format(start);

  if (!endsAt) {
    return `${date} / ${startTime}`;
  }

  return `${date} / ${startTime} to ${timeFormatter.format(new Date(endsAt))}`;
};

export const ScheduleDateTime = ({ endsAt, startsAt }: ScheduleDateTimeProps): React.ReactNode => {
  const fallbackLabel = formatRange(startsAt, endsAt, "en", "Europe/Amsterdam");
  const [label, setLabel] = useState<string>(fallbackLabel);
  const [timeZone, setTimeZone] = useState<string>("Europe/Amsterdam");

  useEffect(() => {
    setLabel(formatRange(startsAt, endsAt));
    setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || "Local time");
  }, [endsAt, startsAt]);

  return (
    <span>
      <time dateTime={startsAt}>{label}</time>
      <small>{timeZone.replaceAll("_", " ")}</small>
    </span>
  );
};
