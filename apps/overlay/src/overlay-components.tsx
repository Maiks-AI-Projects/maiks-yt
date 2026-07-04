import type { OverlayActiveGoalState } from "@maiks-yt/events";
import type { CSSProperties } from "react";

import {
  clampGoalProgress,
  formatGoalAmount,
  type CenterNotificationRuntime,
  type FakeChatMessage,
  type TopBarNotification
} from "./overlay-client.service.js";

const safeDefaultAvatarUrl = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23161b22'/%3E%3Ccircle cx='32' cy='25' r='11' fill='%23f2c94c'/%3E%3Cpath d='M14 57c3-13 13-20 18-20s15 7 18 20' fill='%23d64545'/%3E%3C/svg%3E";

export const TopNotificationBar = ({
  notifications,
  slotStyle
}: {
  notifications: TopBarNotification[];
  slotStyle: CSSProperties;
}): React.ReactNode => {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="top-bar-notifications" aria-live="polite" style={slotStyle}>
      {notifications.map((notification, index) => (
        <article
          className={`top-bar-card ${notification.priority} ${notification.platform} ${notification.kind}`}
          key={notification.id}
          style={{ "--top-bar-index": index } as CSSProperties}
        >
          {notification.kind === "community-highlight" ? (
            <span className="top-bar-rank">{notification.actorName}</span>
          ) : null}
          <div className="top-bar-line">
            <img
              alt=""
              className="top-bar-avatar"
              src={notification.avatarUrl || safeDefaultAvatarUrl}
              onError={(event) => {
                if (event.currentTarget.src !== safeDefaultAvatarUrl) {
                  event.currentTarget.src = safeDefaultAvatarUrl;
                }
              }}
            />
            {notification.kind === "community-highlight" ? (
              <span className="top-bar-action">{notification.actionLabel}</span>
            ) : (
              <>
                <strong>{notification.actorName}</strong>
                <span className="top-bar-action">{notification.actionLabel}</span>
              </>
            )}
          </div>
        </article>
      ))}
    </div>
  );
};

export const CenterNotification = ({
  runtime,
  slotStyle
}: {
  runtime: CenterNotificationRuntime;
  slotStyle: CSSProperties;
}): React.ReactNode => {
  const { notification, phase } = runtime;
  const center = notification.center;

  if (!center) {
    return null;
  }

  return (
    <div className="center-notification-zone" style={slotStyle}>
      <article
        className={`center-notification-card ${notification.priority} ${phase}`}
        aria-live="assertive"
        style={{ "--center-fade-ms": `${center.timing.fadeOutMs}ms` } as CSSProperties}
      >
        {center.imageUrl ? <img alt="" className="center-notification-image" src={center.imageUrl} /> : null}
        <div className="center-notification-copy">
          <strong>{center.title}</strong>
          <span>{center.message}</span>
        </div>
      </article>
    </div>
  );
};

export const StreamGoalWidget = ({
  goal,
  slotStyle
}: {
  goal: OverlayActiveGoalState;
  slotStyle: CSSProperties;
}): React.ReactNode => {
  const progress = clampGoalProgress(goal);
  const progressPercent = Math.round(progress * 100);

  return (
    <section className="stream-goal-widget" style={slotStyle} aria-label={goal.label}>
      <div className="stream-goal-copy">
        <strong>{goal.label}</strong>
        <span>{formatGoalAmount(goal.currentAmount, goal.currencyCode)} / {formatGoalAmount(goal.targetAmount, goal.currencyCode)}</span>
      </div>
      <div className="stream-goal-meter" aria-hidden="true">
        <div className="stream-goal-fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <span className="stream-goal-percent">{progressPercent}%</span>
    </section>
  );
};

export const FakeChatOverlay = ({
  newestOnTop,
  messages,
  slotStyle
}: {
  newestOnTop: boolean;
  messages: FakeChatMessage[];
  slotStyle: CSSProperties;
}): React.ReactNode => {
  if (messages.length === 0) {
    return null;
  }

  return (
    <section
      className={`fake-chat-overlay ${newestOnTop ? "newest-on-top" : "newest-on-bottom"}`}
      style={slotStyle}
      aria-label="Fake chat messages"
      aria-live="polite"
    >
      {messages.map((message) => (
        <article className="fake-chat-message" key={message.id}>
          <strong>{message.authorName}</strong>
          <span>{message.message}</span>
        </article>
      ))}
    </section>
  );
};
