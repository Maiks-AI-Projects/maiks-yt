const notificationsReturnTarget = "https://maiks.yt/tools/notifications";

export const createNotificationsAccessRecoveryPath = (): string => {
  const search = new URLSearchParams({
    returnTo: notificationsReturnTarget
  });

  return `/access/recovery?${search.toString()}`;
};
