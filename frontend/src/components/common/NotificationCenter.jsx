import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/stores/shop.store";
import { useNotifications } from "@/stores/notification.store";
import { disablePush, enablePush, listenForPush, pushOwner } from "@/lib/push";
import "@/styles/notifications.css";

export function NotificationRuntime() {
  const user = useAuth(s => s.user);
  useEffect(() => {
    useNotifications.getState().reset();
    if (!user) return;
    let active = true;
    let unsubscribe = () => {};
    const refresh = () => { if (active) useNotifications.getState().refresh(); };
    refresh();
    const timer = setInterval(refresh, 10000);
    window.addEventListener("focus", refresh);
    listenForPush(payload => {
      if (!active || payload.data?.userId !== user.id) return;
      refresh(); window.dispatchEvent(new Event("gce-refresh"));
      toast(payload.data.title || "Gốm Cho Em có cập nhật mới", { id: payload.data.notificationId, description: payload.data.body });
    }).then(stop => { if (!active) stop(); else unsubscribe = stop; }).catch(() => {});
    if (pushOwner() === user.id) enablePush(user.id, false).catch(() => {});
    return () => { active = false; clearInterval(timer); unsubscribe(); window.removeEventListener("focus", refresh); };
  }, [user]);
  return null;
}
export default function NotificationCenter() {
  const user = useAuth(s => s.user);
  return user ? <NotificationPanel key={user.id}/> : null;
}
function NotificationPanel() {
  const user = useAuth(s => s.user);
  const { data, error, refresh, read } = useNotifications();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pushOn, setPushOn] = useState(() => pushOwner() === user?.id);
  const ref = useRef(null);
  const navigate = useNavigate();
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const escape = e => { if (e.key === "Escape") { setOpen(false); ref.current?.querySelector("button")?.focus(); } };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", escape); };
  }, [open]);
  if (!user) return null;
  async function togglePush() {
    setBusy(true);
    try { if (pushOn) await disablePush(); else await enablePush(user.id); setPushOn(!pushOn); toast.success(pushOn ? "Đã tắt thông báo đẩy trên trình duyệt này" : "Đã bật thông báo đẩy"); }
    catch (e) { toast.error(e.message); }
    finally { setBusy(false); }
  }
  async function openNotice(item) {
    try { await read(item.id); setOpen(false); navigate(item.url); window.dispatchEvent(new Event("gce-refresh")); }
    catch (e) { toast.error(e.message); }
  }
  return <div className="notification-center" ref={ref}>
    <button className="icon-btn notification-bell" aria-label={`Thông báo${data?.unread ? `, ${data.unread} chưa đọc` : ""}`} aria-expanded={open} onClick={() => { setOpen(!open); if (!open) refresh(); }}><Bell size={21}/>{data?.unread > 0 && <b>{data.unread > 99 ? "99+" : data.unread}</b>}</button>
    {open && <section className="notification-panel" aria-label="Thông báo của bạn">
      <header><h2>Thông báo</h2><button className="icon-btn" aria-label="Đóng thông báo" onClick={()=>setOpen(false)}><X size={18}/></button></header>
      <div className="notification-tools"><button disabled={busy || !data?.pushEnabled} onClick={togglePush}>{busy ? "Đang cập nhật…" : pushOn ? "Tắt thông báo đẩy" : "Bật thông báo đẩy"}</button><button disabled={!data?.unread} onClick={()=>read().catch(e=>toast.error(e.message))}><CheckCheck size={15}/>Đọc tất cả</button></div>
      {!data?.pushEnabled && <p className="notification-hint">Thông báo trong website vẫn hoạt động. Tiệm chưa bật cấu hình gửi push.</p>}
      {error && <p role="alert" className="notification-hint">{error}</p>}
      {!data ? <p className="notification-hint">Đang tải thông báo…</p> : !data.items.length ? <p className="notification-empty">Chưa có thông báo mới.<br/>Những cập nhật của tiệm sẽ xuất hiện ở đây.</p> : <div className="notification-list">{data.items.map(item=><button key={item.id} className={`notification-item ${item.readAt ? "" : "unread"}`} onClick={()=>openNotice(item)}><span className="notification-dot"/><span><strong>{item.title}</strong><span>{item.body}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("vi-VN")}</time></span></button>)}</div>}
    </section>}
  </div>;
}
