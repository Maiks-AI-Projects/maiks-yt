self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        body: event.data.text()
      };
    }
  }

  const title = typeof payload.title === "string" && payload.title.length > 0
    ? payload.title
    : "Maiks.yt notification";
  const body = typeof payload.body === "string" ? payload.body : "";
  const url = typeof payload.actionUrl === "string" && payload.actionUrl.length > 0
    ? payload.actionUrl
    : "/tools/notifications";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icons/maiks-tools-icon.svg",
      badge: "/icons/maiks-tools-maskable.svg",
      data: {
        url
      },
      tag: typeof payload.tag === "string" ? payload.tag : undefined
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const rawUrl = event.notification.data && typeof event.notification.data.url === "string"
    ? event.notification.data.url
    : "/tools/notifications";
  const parsedUrl = new URL(rawUrl, self.location.origin);
  const targetUrl = parsedUrl.origin === self.location.origin
    ? parsedUrl
    : new URL("/tools/notifications", self.location.origin);

  event.waitUntil((async () => {
    const windowClients = await self.clients.matchAll({
      includeUncontrolled: true,
      type: "window"
    });

    for (const client of windowClients) {
      const clientUrl = new URL(client.url);

      if (clientUrl.origin === targetUrl.origin && clientUrl.pathname === targetUrl.pathname) {
        await client.focus();
        return;
      }
    }

    await self.clients.openWindow(targetUrl.href);
  })());
});
