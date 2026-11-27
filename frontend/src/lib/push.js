import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { app, firebaseConfigured, firebaseConfig } from "@/lib/firebase";
import workerUrl from "../firebase-messaging-sw.js?worker&url";

const tokenKey = "gce-fcm-token";
const ownerKey = "gce-push-owner";
const cacheName = "gce-push-session";
export async function supportsPush() { return firebaseConfigured && !!import.meta.env.VITE_FIREBASE_VAPID_KEY?.trim() && window.isSecureContext && "Notification" in window && await isSupported(); }
async function tokenRequest(method, token, accessToken) {
  if (!accessToken || !token) return;
  const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
  const response = await fetch(`${base}/shop/notifications/tokens`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ token, ...(method === "POST" ? { projectId: firebaseConfig.projectId } : {}) }) });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error?.message || "Không cập nhật được đăng ký thông báo. Vui lòng thử lại.");
  }
}
async function setWorkerUser(id) {
  const cache = await caches.open(cacheName);
  if (id) await cache.put("/__gce_push_user__", new Response(id));
  else await cache.delete("/__gce_push_user__");
}
export async function enablePush(userId, askPermission = true) {
  const accessToken = sessionStorage.getItem("gce-token");
  if (!await supportsPush()) throw new Error("Trình duyệt chưa hỗ trợ hoặc cấu hình Firebase/VAPID chưa đầy đủ. Vẫn xem được thông báo trong website.");
  const permission = askPermission ? await Notification.requestPermission() : Notification.permission;
  if (permission !== "granted") throw new Error("Bạn chưa cho phép thông báo. Có thể bật lại trong cài đặt trình duyệt.");
  const registration = await navigator.serviceWorker.register(workerUrl, { type: "module", scope: "/" });
  if (!registration.active) await new Promise((resolve, reject) => {
    const worker = registration.installing || registration.waiting;
    if (!worker) return reject(new Error("Chưa khởi động được service worker thông báo."));
    const timeout = setTimeout(() => reject(new Error("Service worker chưa sẵn sàng. Thử tải lại trang.")), 15000);
    worker.addEventListener("statechange", () => { if (worker.state === "activated") { clearTimeout(timeout); resolve(); } else if (worker.state === "redundant") { clearTimeout(timeout); reject(new Error("Không khởi động được thông báo nền.")); } });
  });
  const token = await getToken(getMessaging(app), { vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error("Chưa lấy được token thông báo. Kiểm tra Web Push VAPID key.");
  if (sessionStorage.getItem("gce-token") !== accessToken || !accessToken) throw new Error("Phiên đăng nhập đã thay đổi. Vui lòng thử lại.");
  await tokenRequest("POST", token, accessToken);
  if (sessionStorage.getItem("gce-token") !== accessToken) { await tokenRequest("DELETE", token, accessToken); return; }
  await setWorkerUser(userId);
  localStorage.setItem(tokenKey, token);
  localStorage.setItem(ownerKey, userId);
}
export async function disablePush(accessToken = sessionStorage.getItem("gce-token")) {
  const token = localStorage.getItem(tokenKey);
  await setWorkerUser(null).catch(() => undefined);
  localStorage.removeItem(ownerKey); localStorage.removeItem(tokenKey);
  const results = await Promise.allSettled([
    tokenRequest("DELETE", token, accessToken),
    (async () => { if (firebaseConfigured && await isSupported()) await deleteToken(getMessaging(app)); })(),
  ]);
  const failure = results.find(result => result.status === "rejected");
  if (failure) throw failure.reason;
}
export const pushOwner = () => localStorage.getItem(ownerKey);
export async function listenForPush(callback) {
  if (!await supportsPush()) return () => {};
  return onMessage(getMessaging(app), callback);
}
