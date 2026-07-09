export const postNotification = async ({ config, http, title, body, severity }) => {
  const secret = process.env.DEV_NOTIFICATION_POST_SECRET;

  if (!secret) {
    return {
      ok: false,
      reason: "DEV_NOTIFICATION_POST_SECRET is not set."
    };
  }

  const response = await http.fetchWithTimeout(http.makeUrl(config.apiUrl, config.notificationPath), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Dev-Notification-Secret": secret
    },
    body: JSON.stringify({
      title,
      body,
      severity,
      source: "dev_smoke",
      actionUrl: http.makeUrl(config.webUrl, "/tools/notifications")
    })
  });

  const responseBody = await response.text();

  return {
    ok: response.ok,
    reason: response.ok ? null : `notification endpoint returned HTTP ${response.status}: ${responseBody.slice(0, 200)}`
  };
};

export const formatFailures = (failures) => failures
  .slice(0, 8)
  .map((failure) => `- ${failure.message}`)
  .join("\n");
