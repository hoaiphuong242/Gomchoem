import { confirmAction } from "@/lib/confirm";
import { useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  Download,
  Gift,
  Heart,
  LogOut,
  Package,
  Settings,
  ShoppingBag,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useRemote } from "@/hooks/useRemote";
import { useAuth } from "@/stores/shop.store";
import {
  post,
  put,
  request,
  downloadInvoice,
  upload,
} from "@/services/api/client";
import { date, money, eventMessage, roles, statuses } from "@/lib/format";
import {
  Badge,
  Empty,
  ErrorBox,
  Loading,
  ProductCard,
} from "@/components/common/ShopUI";

export function Account() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const update = useAuth((s) => s.update);
  const [tab, setTab] = useState("orders");
  const [version, setVersion] = useState(0);
  const { data, error } = useRemote(user ? "/shop/account" : null, version);
  const orders = useRemote(user ? "/shop/orders" : null, version);
  const [busy, setBusy] = useState(false);
  if (!user) return <Navigate to="/dang-nhap" replace />;
  if (error)
    return (
      <div className="container section">
        <ErrorBox error={error} />
        <button className="btn" onClick={logout}>
          Đăng nhập lại
        </button>
      </div>
    );
  if (!data) return <Loading />;
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const result = await put("/shop/account", {
        name: f.get("name"),
        phone: f.get("phone"),
        address: f.get("address"),
        city: f.get("city"),
        notifyNew: f.get("notifyNew") === "on",
      });
      update(result.user);
      setVersion((v) => v + 1);
      toast.success("Đã cập nhật góc gốm của bạn");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  const collected = orders.data?.filter((o) => o.status === "DELIVERED") || [];
  return (
    <div className="container section">
      <div className="account-banner">
        <div className="avatar">
          <UserRound size={32} />
        </div>
        <div>
          <div className="eyebrow">NGƯỜI BẠN CỦA TIỆM</div>
          <h1>{data.user.name}</h1>
          <p>
            {data.user.email} · {roles[data.user.role]}
          </p>
        </div>
        <div className="account-actions">
          {user.role !== "USER" && (
            <Link className="btn secondary" to="/quan-tri">
              Vào quản trị
            </Link>
          )}
          <button className="text-link" onClick={logout}>
            <LogOut size={16} />
            Đăng xuất
          </button>
        </div>
      </div>
      <div className="account-stats">
        <div>
          <Gift />
          <span>
            Hạng thành viên
            <strong>
              {data.loyaltyRate === 0.1
                ? "Men Hỏa Biến · giảm 10%"
                : data.loyaltyRate === 0.05
                  ? "Trà Mộc · giảm 5%"
                  : "Bạn mới của tiệm"}
            </strong>
          </span>
        </div>
        <div>
          <ShoppingBag />
          <span>
            Đã sưu tầm<strong>{data.quantity} món gốm</strong>
          </span>
        </div>
        <div>
          <Heart />
          <span>
            Tổng mua thành công<strong>{money(data.spent)}</strong>
          </span>
        </div>
      </div>
      <div className="tabs account-tabs">
        {[
          [Package, "orders", "Đơn hàng"],
          [Gift, "collection", "Gốm đã sưu tầm"],
          [Heart, "wishlist", "Những món đang thương"],
          [Settings, "settings", "Thông tin & địa chỉ"],
        ].map(([Icon, key, title]) => (
          <button
            key={key}
            className={key === tab ? "active" : ""}
            onClick={() => setTab(key)}
          >
            <Icon size={17} />
            {title}
          </button>
        ))}
      </div>
      {tab === "orders" &&
        (orders.error ? (
          <ErrorBox error={orders.error} />
        ) : !orders.data ? (
          <Loading />
        ) : orders.data.length ? (
          <div className="order-list">
            {orders.data.map((o) => (
              <Link
                key={o.id}
                className="panel order-card"
                to={`/don-hang/${o.id}`}
              >
                <div className="order-title">
                  <strong>{o.code}</strong>
                  <Badge status={o.status} />
                </div>
                <p className="muted">{date(o.submittedAt || o.createdAt)}</p>
                <div className="order-thumbs">
                  {o.items.map((i) => (
                    <img key={i.id} src={i.image} alt={i.name} />
                  ))}
                  <span>{o.items.reduce((s, i) => s + i.quantity, 0)} món</span>
                  <strong>{money(o.total)}</strong>
                </div>
                <div className="order-card-footer">
                  <span>{statuses[o.paymentStatus]}</span>
                  <span>Xem chi tiết</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <Empty title="Bạn chưa có đơn hàng nào" />
        ))}
      {tab === "collection" &&
        (collected.length ? (
          <div className="collection-grid">
            {collected.flatMap((o) =>
              o.items.map((i) => (
                <div className="panel" key={i.id}>
                  <img src={i.image} alt={i.name} />
                  <h3>{i.name}</h3>
                  <p>
                    {date(o.deliveredAt)} · {i.quantity} chiếc
                  </p>
                  <Link to={`/don-hang/${o.id}`} className="text-link">
                    Xem đơn đã mua
                  </Link>
                </div>
              )),
            )}
          </div>
        ) : (
          <Empty title="Bộ sưu tập đang đợi món đầu tiên" />
        ))}
      {tab === "wishlist" &&
        (data.wishlist.length ? (
          <div className="product-grid">
            {data.wishlist.map((p) => (
              <div key={p.id}>
                <ProductCard product={p} />
                <button
                  className="text-link remove-wish"
                  onClick={async () => {
                    try {
                      await request(`/shop/wishlist/${p.id}`, {
                        method: "DELETE",
                      });
                      setVersion((v) => v + 1);
                    } catch (err) {
                      toast.error(err.message);
                    }
                  }}
                >
                  Bỏ lưu món này
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty title="Chưa có món nào trong danh sách yêu thích" />
        ))}
      {tab === "settings" && (
        <form className="panel settings-form" onSubmit={save}>
          <h2>Thông tin & địa chỉ</h2>
          <div className="form-grid">
            <label>
              Họ và tên
              <input
                required
                name="name"
                defaultValue={data.user.name}
                maxLength={100}
              />
            </label>
            <label>
              Điện thoại
              <input
                name="phone"
                defaultValue={data.user.phone || ""}
                maxLength={20}
              />
            </label>
          </div>
          <label>
            Địa chỉ
            <input
              name="address"
              defaultValue={data.user.address || ""}
              maxLength={500}
            />
          </label>
          <label>
            Tỉnh / thành phố
            <input
              name="city"
              defaultValue={data.user.city || ""}
              maxLength={100}
            />
          </label>
          <label className="check-inline">
            <input
              type="checkbox"
              name="notifyNew"
              defaultChecked={data.user.notifyNew}
            />
            Đăng ký quan tâm kiện mới (tiệm ghi nhận tùy chọn; email thông báo
            cần cấu hình dịch vụ gửi)
          </label>
          <p className="muted">
            Thành viên Trà Mộc từ 10 món đã nhận: giảm 5%; Men Hỏa Biến từ 20
            món: giảm 10%. Hàng hoàn trả được loại khỏi tích lũy.
          </p>
          <button className="btn" disabled={busy}>
            Lưu thông tin
          </button>
        </form>
      )}
    </div>
  );
}

export function OrderDetail() {
  const [now] = useState(() => Date.now());
  const { id } = useParams();
  const user = useAuth((s) => s.user);
  const [version, setVersion] = useState(0);
  const { data: o, error } = useRemote(
    user ? `/shop/orders/${id}` : null,
    version,
  );
  const [busy, setBusy] = useState(false);
  if (!user) return <Navigate to={`/dang-nhap?next=/don-hang/${id}`} replace />;
  if (error)
    return (
      <div className="container section">
        <ErrorBox error={error} />
      </div>
    );
  if (!o) return <Loading />;
  async function cancel() {
    if (!(await confirmAction("Bạn muốn hủy đơn này?"))) return;
    setBusy(true);
    try {
      await post(`/shop/orders/${id}/cancel`);
      setVersion((v) => v + 1);
      toast.success("Đã hủy đơn và cập nhật tồn kho");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function returnOrder(e) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const file = f.get("video");
      const evidence = file?.size
        ? (await upload(file)).url
        : f.get("evidence");
      await post(`/shop/orders/${id}/returns`, {
        reason: f.get("reason"),
        evidence,
      });
      setVersion((v) => v + 1);
      toast.success("Tiệm đã nhận yêu cầu đổi trả");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  const canReturn =
    o.status === "DELIVERED" &&
    o.deliveredAt &&
    now - new Date(o.deliveredAt).getTime() <= 48 * 3600000 &&
    !o.returns.some((r) => r.status !== "REJECTED");
  return (
    <div className="container section">
      <div className="section-heading">
        <div>
          <div className="eyebrow">KIỆN GỐM CỦA BẠN</div>
          <h1 className="order-code">{o.code}</h1>
          <Badge status={o.status} />
        </div>
        <button
          className="btn secondary"
          onClick={() =>
            downloadInvoice(id).catch((e) => toast.error(e.message))
          }
        >
          <Download size={17} />
          Tải biên nhận PDF
        </button>
      </div>
      {o.status === "PENDING_PAYMENT" && (
        <div className="notice">
          Tiệm đang kiểm tra tiền chuyển khoản. Sản phẩm vẫn được giữ cho đơn
          của bạn. Nếu chuyển khoản muộn hoặc sai nội dung, hãy liên hệ
          Instagram @gomchoem.
        </div>
      )}
      <div className="checkout-grid">
        <div>
          <section className="panel">
            <h2>Những món đã chọn</h2>
            {o.items.map((i) => (
              <div className="line-item" key={i.id}>
                <img src={i.image} alt={i.name} />
                <div>
                  <strong>{i.name}</strong>
                  <p>
                    {i.sku} · {i.quantity} chiếc
                  </p>
                </div>
                <strong>{money(i.unitPrice * i.quantity)}</strong>
              </div>
            ))}
          </section>
          <section className="panel timeline">
            <h2>Hành trình kiện gốm</h2>
            {o.events.map((ev) => (
              <div key={ev.id}>
                <span />
                <div>
                  <strong>{eventMessage(ev.message)}</strong>
                  <p>{date(ev.createdAt)}</p>
                </div>
              </div>
            ))}
          </section>
          {o.trackingCode && (
            <div className="notice">
              Mã vận đơn: <strong>{o.trackingCode}</strong>. Liên hệ tiệm để
              biết đơn vị vận chuyển và trạng thái chi tiết.
            </div>
          )}
          {canReturn && (
            <form className="panel" onSubmit={returnOrder}>
              <h2>Yêu cầu đổi trả</h2>
              <p className="muted">
                Trong 48 giờ từ lúc nhận hàng. Đính kèm video mở kiện để tiệm
                kiểm tra.
              </p>
              <label>
                Lý do
                <textarea name="reason" required maxLength={2000} />
              </label>
              <label>
                Video mở kiện (MP4/WebM, tối đa 50MB)
                <input name="video" type="file" accept="video/mp4,video/webm" />
              </label>
              <label>
                Hoặc liên kết video công khai
                <input name="evidence" type="url" placeholder="https://…" />
              </label>
              <button className="btn" disabled={busy}>
                Gửi yêu cầu
              </button>
            </form>
          )}
          {o.returns.map((r) => (
            <div key={r.id} className="panel">
              <h3>Yêu cầu đổi trả</h3>
              <Badge status={r.status} />
              <p>{r.reason}</p>
              <p>{r.staffNote}</p>
              {r.refund > 0 && <p>Đã ghi nhận hoàn: {money(r.refund)}</p>}
            </div>
          ))}
        </div>
        <aside className="panel summary">
          <h2>Thông tin đơn hàng</h2>
          <p>
            <strong>{o.recipientName}</strong>
            <br />
            {o.phone}
          </p>
          <p>{o.pickup ? "Nhận tại cửa hàng" : `${o.address}, ${o.city}`}</p>
          {o.note && <p>Ghi chú: {o.note}</p>}
          {o.giftWrap && <p>✓ Gói quà & viết thiệp</p>}
          <hr />
          <div>
            <span>Tạm tính</span>
            <strong>{money(o.subtotal)}</strong>
          </div>
          <div>
            <span>Giảm giá</span>
            <strong>−{money(o.discount)}</strong>
          </div>
          <div>
            <span>Phí ship</span>
            <strong>{money(o.shippingFee)}</strong>
          </div>
          <div className="summary-total">
            <span>Tổng cộng</span>
            <strong>{money(o.total)}</strong>
          </div>
          <p>
            {o.paymentMethod} · {statuses[o.paymentStatus]}
          </p>
          {o.paymentMethod === "VNPAY" && o.status === "PENDING_PAYMENT" && (
            <div className="notice"><p>VNPay đang chờ xử lý. Tiệm tiếp tục giữ hàng đến khi có kết quả đối soát.</p>
              {o.payment?.status === "PENDING" && new Date(o.payment.expiresAt).getTime() > now && <button className="btn full" disabled={busy} onClick={async () => {
                setBusy(true);
                try { const result = await post(`/shop/orders/${id}/vnpay`); window.location.assign(result.url); } catch (e) { toast.error(e.message); setBusy(false); }
              }}>Tiếp tục thanh toán VNPay</button>}
            </div>
          )}
          {o.payment?.status === "REVIEW" && <p className="notice">Tiệm cần đối soát khoản VNPay đã nhận. Vui lòng liên hệ kèm mã đơn và không thanh toán thêm.</p>}
          {o.emails?.length > 0 && <p className="muted">Biên nhận qua email: {o.emails.some(e => e.status === "SENT") ? "Đã chuyển đến dịch vụ gửi email. Bạn kiểm tra hộp thư và mục Spam nhé." : o.emails.some(e => e.status === "FAILED") ? "Chưa gửi được. Bạn có thể tải PDF tại trang này hoặc liên hệ tiệm." : "Đang chờ gửi."}</p>}
          {["CONFIRMED", "PACKING"].includes(o.status) && o.paymentStatus !== "PAID" && (
            <button
              className="btn secondary full"
              disabled={busy}
              onClick={cancel}
            >
              Yêu cầu hủy đơn
            </button>
          )}
          {o.status === "SHIPPED" && (
            <p className="muted">
              Đơn đã giao vận chuyển. Liên hệ tiệm nếu cần hủy; người mua chịu
              phí ship.
            </p>
          )}
          <Link className="text-link" to="/tai-khoan">
            Về tài khoản
          </Link>
        </aside>
      </div>
    </div>
  );
}
