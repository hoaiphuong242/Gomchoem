import { initializeApp } from "firebase/app";
import { getMessaging, onBackgroundMessage } from "firebase/messaging/sw";
import { firebaseConfig } from "./lib/firebase-config";

self.addEventListener("install", event => event.waitUntil(self.skipWaiting()));
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const path = event.notification.data?.url || "/tai-khoan";
  const url = new URL(path, self.location.origin);
  if (url.origin !== self.location.origin || !["/tai-khoan", "/quan-tri"].includes(url.pathname)) return;
  event.waitUntil(self.clients.openWindow(url.href));
});
const messaging = getMessaging(initializeApp(firebaseConfig));
onBackgroundMessage(messaging, async payload => {
  const data = payload.data || {};
  const cache = await caches.open("gce-push-session");
  const session = await cache.match("/__gce_push_user__");
  if (!session || (await session.text()) !== data.userId) return;
  await self.registration.showNotification(data.title || "Gốm Cho Em có thông báo mới", { body: data.body || "Mở website để xem cập nhật dành cho bạn.", icon: "/brand/gomchoem-logo.jpg", tag: data.notificationId, data: { url: data.url } });
});
