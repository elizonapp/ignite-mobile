self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "elizon", body: event.data.text() };
  }
  const title = payload.title || "elizon";
  const options = {
    body: payload.body || "",
    tag: payload.tag || "elizon-push",
    data: payload.data || {},
    icon: "/favicon.ico",
    badge: "/favicon.ico",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const serviceId = typeof data.serviceId === "string" ? data.serviceId : undefined;
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        client.postMessage({ type: "elizon-push-click", serviceId });
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("./index.html");
      return undefined;
    }),
  );
});
