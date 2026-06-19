import {
  cancellationReasonLabels,
  formatScheduleDate,
  formatScheduleLabel,
  getPublicStreamSchedule
} from "./stream-schedule-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stream Schedule | Maiks.yt",
  description: "Upcoming public streams and cancellation notes."
};

const SchedulePage = async (): Promise<React.ReactNode> => {
  const result = await getPublicStreamSchedule();

  return (
    <main className="schedule-page">
      <header className="schedule-header">
        <p className="eyebrow">Schedule</p>
        <h1>Stream Schedule</h1>
        <p>Upcoming public streams, kept manual for now so changes stay easy to review.</p>
        {result.status === "fallback" ? (
          <p className="schedule-fallback-note" aria-live="polite">
            Showing fallback schedule data while the live schedule API is unavailable.
          </p>
        ) : null}
      </header>

      {result.streams.length === 0 ? (
        <section className="project-state-card empty">
          <h2>No public streams scheduled</h2>
          <p>New streams will appear here after they are marked public.</p>
        </section>
      ) : (
        <section className="schedule-list" aria-label="Upcoming public streams">
          {result.streams.map((stream) => (
            <article className={`schedule-card ${stream.status}`} key={stream.id}>
              <div className="schedule-card-meta">
                <span>{formatScheduleLabel(stream.channelKey)}</span>
                <span>{stream.topicKey ? formatScheduleLabel(stream.topicKey) : "General"}</span>
                <span>{formatScheduleLabel(stream.status)}</span>
              </div>
              <h2>{stream.title}</h2>
              <p className="schedule-time">
                {formatScheduleDate(stream.startsAt)}
                {stream.endsAt ? ` until ${formatScheduleDate(stream.endsAt)}` : ""}
              </p>
              {stream.description ? <p>{stream.description}</p> : null}
              {stream.status === "cancelled" ? (
                <div className="schedule-cancellation" role="status">
                  <strong>Cancelled</strong>
                  <span>
                    {stream.cancellationReasonCode ? cancellationReasonLabels[stream.cancellationReasonCode] : "Cancellation"}: {stream.cancellationReason}
                  </span>
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </main>
  );
};

export default SchedulePage;
