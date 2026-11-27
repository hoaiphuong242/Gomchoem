import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Clock, Gift, Minus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, useCart } from "@/stores/shop.store";
import { useRemote } from "@/hooks/useRemote";
import { get, post } from "@/services/api/client";
import { money } from "@/lib/format";
import { Benefits, Empty, ErrorBox, Loading } from "@/components/common/ShopUI";

export function Cart() {
  const items = useCart((s) => s.items);
  const quantity = useCart((s) => s.quantity);
  const remove = useCart((s) => s.remove);
  const user = useAuth((s) => s.user);
  const [busy, setBusy] = useState(false);
  const catalog = useRemote("/shop/products?limit=100").data;
  const navigate = useNavigate();
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  async function checkout() {
    if (!user) return navigate("/dang-nhap?next=/gio-hang");
    setBusy(true);
    try {
      const order = await post("/shop/reservations", {
        items: items.map(({ productId, quantity }) => ({
          productId,
          quantity,
        })),
      });
      sessionStorage.setItem("gce-reservation", order.id);
      navigate("/thanh-toan");
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container section">
      <div className="page-heading compact">
        <div className="eyebrow">NHỮNG MÓN BẠN ĐÃ THƯƠNG</div>
        <h1>
          Giỏ gốm đã chọn<span className="title-count">{items.length}</span>
        </h1>
        <p>Chọn chậm một chút. Một món vừa ý sẽ ở lại thật lâu.</p>
      </div>
      {!items.length ? (
        <Empty title="Giỏ gốm đang chờ bạn" />
      ) : (
        <div className="checkout-grid">
          <section className="panel">
            <h2>Kiện gốm của bạn</h2>
            {items.map((i) => {
              const live = catalog?.items.find((p) => p.id === i.productId);
              const sold = live && live.available <= 0;
              return (
                <div className="cart-item" key={i.productId}>
                  <Link to={`/san-pham/${i.slug}`}>
                    <img src={i.image} alt={i.name} />
                  </Link>
                  <div>
                    <Link to={`/san-pham/${i.slug}`}>
                      <h3>{i.name}</h3>
                    </Link>
                    <p>{money(live?.price ?? i.price)} / chiếc</p>
                    {sold ? (
                      <span className="badge">
                        Sold out · vui lòng bỏ khỏi giỏ
                      </span>
                    ) : (
                      <div className="quantity">
                        <button
                          aria-label="Giảm số lượng"
                          disabled={i.quantity <= 1}
                          onClick={() => quantity(i.productId, i.quantity - 1)}
                        >
                          <Minus size={14} />
                        </button>
                        <span>{i.quantity}</span>
                        <button
                          aria-label="Tăng số lượng"
                          disabled={live && i.quantity >= live.available}
                          onClick={() => quantity(i.productId, i.quantity + 1)}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}
                    {live && i.quantity > live.available && !sold && (
                      <p className="error-text">
                        Hiện chỉ còn {live.available} chiếc.
                      </p>
                    )}
                  </div>
                  <div className="cart-item-end">
                    <button
                      className="icon-btn"
                      onClick={() => remove(i.productId)}
                      aria-label={`Xóa ${i.name}`}
                    >
                      <Trash2 size={16} />
                    </button>
                    <strong>
                      {money((live?.price ?? i.price) * i.quantity)}
                    </strong>
                  </div>
                </div>
              );
            })}
            <Link to="/san-pham" className="text-link">
              Tiếp tục ngắm gốm
            </Link>
          </section>
          <aside className="panel summary">
            <h2>Tóm tắt giỏ gốm</h2>
            <div>
              <span>Tạm tính theo giỏ</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <div>
              <span>Đóng gói chống sốc</span>
              <span>Tiệm tặng</span>
            </div>
            <p className="muted">
              Giá, tồn kho và ưu đãi được kiểm tra lại khi thanh toán. Phí ship
              20k trong Đà Nẵng, 35k ngoài thành phố.
            </p>
            <div className="summary-total">
              <span>Tạm tính</span>
              <strong>{money(subtotal)}</strong>
            </div>
            <button className="btn full" disabled={busy} onClick={checkout}>
              {busy ? "Đang kiểm tra kho…" : "Thanh toán · Giữ hàng 3 phút"}
            </button>
            <div className="gentle-note">
              <ShieldCheck size={18} />
              <p>
                Thêm vào giỏ chưa giữ hàng. Món hết hàng sẽ không thể đặt mua.
              </p>
            </div>
          </aside>
        </div>
      )}
      <Benefits />
    </div>
  );
}

export function Checkout() {
  const [id] = useState(() => sessionStorage.getItem("gce-reservation"));
  const user = useAuth((s) => s.user);
  const { data: order, error } = useRemote(
    user && id ? `/shop/orders/${id}` : null,
  );
  const account = useRemote(user ? "/shop/account" : null).data;
  const settings = useRemote("/shop/settings").data;
  const [now, setNow] = useState(() => Date.now());
  const [pickup, setPickup] = useState(false);
  const [payment, setPayment] = useState("COD");
  const [quote, setQuote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [city, setCity] = useState("Đà Nẵng");
  const [copied, setCopied] = useState(false);
  const clear = useCart((s) => s.clear);
  const navigate = useNavigate();
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = order
    ? Math.max(0, Math.ceil((new Date(order.expiresAt).getTime() - now) / 1000))
    : 180;
  useEffect(() => {
    if (order?.status === "RESERVED" && seconds === 0) {
      sessionStorage.removeItem("gce-reservation");
      toast.info("Hết 3 phút giữ hàng. Tiệm đã đưa bạn về giỏ.");
      navigate("/gio-hang", { replace: true });
    }
  }, [order, seconds, navigate]);
  if (!user) return <Navigate to="/dang-nhap?next=/gio-hang" replace />;
  if (!id) return <Navigate to="/gio-hang" replace />;
  if (error)
    return (
      <div className="container section">
        <ErrorBox error={error} />
        <Link className="btn" to="/gio-hang">
          Về giỏ hàng
        </Link>
      </div>
    );
  if (!order) return <Loading />;
  if (order.status !== "RESERVED")
    return (
      <Navigate
        to={order.status === "EXPIRED" ? "/gio-hang" : `/don-hang/${id}`}
        replace
      />
    );
  const shipping = pickup
    ? 0
    : city
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .replace(/đ/g, "d")
          .replace(/[^a-z]/g, "") === "danang"
      ? 20000
      : 35000;
  const total = quote?.total ?? order.subtotal + shipping;
  const dataFrom = (form) => {
    const f = new FormData(form);
    return {
      recipientName: f.get("recipientName"),
      phone: f.get("phone"),
      address: f.get("address") || "",
      city,
      pickup,
      giftWrap: f.get("giftWrap") === "on",
      note: f.get("note") || "",
      voucherCode: f.get("voucherCode") || "",
      paymentMethod: payment,
    };
  };
  async function checkQuote(e) {
    const form = e.currentTarget.form;
    if (!form.reportValidity()) return;
    setBusy(true);
    try {
      setQuote(await post(`/shop/orders/${id}/quote`, dataFrom(form)));
      toast.success("Đã kiểm tra ưu đãi và phí giao hàng");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const o = await post(
        `/shop/orders/${id}/submit`,
        dataFrom(e.currentTarget),
      );
      if (o.paymentMethod === "VNPAY" && o.paymentStatus !== "PAID") {
        const paymentSession = await post(`/shop/orders/${o.id}/vnpay`);
        window.location.assign(paymentSession.url);
        return;
      }
      clear();
      sessionStorage.removeItem("gce-reservation");
      toast.success(
        payment === "TRANSFER"
          ? "Tiệm sẽ kiểm tra khoản chuyển của bạn"
          : "Tiệm đã nhận đơn gốm",
      );
      navigate(`/don-hang/${o.id}`, { replace: true });
    } catch (err) {
      toast.error(err.message);
      if (err.status === 409) {
        const fresh = await get(`/shop/orders/${id}`).catch(() => null);
        if (fresh?.status === "EXPIRED") navigate("/gio-hang");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link to="/gio-hang">Giỏ gốm</Link> / Thanh toán
      </div>
      <div className="reservation-banner">
        <Clock size={28} />
        <div>
          <h2>Đang giữ những món gốm cho bạn</h2>
          <p>
            Hoàn tất đặt hàng trong 3 phút. Hết hạn, hàng được mở bán trở lại.
          </p>
        </div>
        <strong className={seconds < 30 ? "urgent" : ""}>
          {String(Math.floor(seconds / 60)).padStart(2, "0")}:
          {String(seconds % 60).padStart(2, "0")}
        </strong>
      </div>
      <form className="checkout-grid" onSubmit={submit}>
        <div>
          <section className="panel">
            <div className="eyebrow">NHẬN MÓN GỐM CỦA BẠN</div>
            <h2>Phương thức nhận hàng</h2>
            <div className="delivery-options">
              <label className={pickup ? "" : "selected"}>
                <input
                  type="radio"
                  name="delivery"
                  checked={!pickup}
                  onChange={() => {
                    setPickup(false);
                    setQuote(null);
                  }}
                />
                <strong>Giao tận nơi</strong>
                <small>20k Đà Nẵng · 35k tỉnh/thành khác</small>
              </label>
              <label className={pickup ? "selected" : ""}>
                <input
                  type="radio"
                  name="delivery"
                  checked={pickup}
                  onChange={() => {
                    setPickup(true);
                    setQuote(null);
                  }}
                />
                <strong>Ghé tiệm nhận gốm</strong>
                <small>Miễn phí giao hàng</small>
              </label>
            </div>
          </section>
          <section className="panel">
            <h2>Thông tin người nhận</h2>
            <div className="form-grid">
              <label>
                Họ và tên *
                <input
                  key={account?.user.name}
                  name="recipientName"
                  defaultValue={account?.user.name || user.name}
                  required
                  maxLength={100}
                  autoComplete="name"
                />
              </label>
              <label>
                Số điện thoại *
                <input
                  key={account?.user.phone}
                  name="phone"
                  defaultValue={account?.user.phone || ""}
                  required
                  pattern="(\+84|0)[0-9]{9,10}"
                  title="Số điện thoại Việt Nam bắt đầu bằng 0 hoặc +84"
                  autoComplete="tel"
                />
              </label>
            </div>
            {!pickup && (
              <>
                <label>
                  Tỉnh / thành phố *
                  <input
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setQuote(null);
                    }}
                    required
                    maxLength={100}
                    autoComplete="address-level1"
                  />
                </label>
                <label>
                  Địa chỉ chi tiết *
                  <input
                    key={account?.user.address}
                    name="address"
                    defaultValue={account?.user.address || ""}
                    required
                    minLength={5}
                    maxLength={500}
                    autoComplete="street-address"
                  />
                </label>
              </>
            )}
            <label>
              Ghi chú / lời nhắn trên thiệp
              <textarea
                name="note"
                maxLength={2000}
                placeholder="Gửi tiệm một lời nhắn…"
              />
            </label>
            <label className="check-inline">
              <input type="checkbox" name="giftWrap" />
              <Gift size={17} /> Gói quà & viết thiệp giúp mình
            </label>
          </section>
          <section className="panel">
            <h2>Phương thức thanh toán</h2>
            <label
              className={`payment-option ${payment === "COD" ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="payment"
                checked={payment === "COD"}
                onChange={() => setPayment("COD")}
              />
              <div>
                <strong>Thanh toán khi nhận hàng (COD)</strong>
                <p>Chốt đơn trong thời gian giữ hàng, thanh toán khi nhận.</p>
              </div>
            </label>
            <label className={`payment-option ${payment === "VNPAY" ? "selected" : ""}`}>
              <input type="radio" name="payment" disabled={!settings?.vnpayEnabled} checked={payment === "VNPAY"} onChange={() => setPayment("VNPAY")} />
              <div><strong>Thanh toán qua VNPay</strong><p>{settings?.vnpayEnabled ? "Quét QR hoặc thanh toán bằng thẻ qua cổng VNPay. Tiếp tục giữ hàng trong phiên thanh toán 15 phút." : "Tiệm chưa bật thanh toán VNPay."}</p></div>
            </label>
            <label
              className={`payment-option ${payment === "TRANSFER" ? "selected" : ""}`}
            >
              <input
                type="radio"
                name="payment"
                disabled={!settings?.bankAccount}
                checked={payment === "TRANSFER"}
                onChange={() => setPayment("TRANSFER")}
              />
              <div>
                <strong>Chuyển khoản ngân hàng</strong>
                <p>
                  {settings?.bankAccount
                    ? "Nhân viên kiểm tra và xác nhận thủ công."
                    : "Tiệm chưa cấu hình tài khoản nhận chuyển khoản."}
                </p>
              </div>
            </label>
            {payment === "TRANSFER" && (
              <div className="bank-box">
                <strong>{settings.bankName}</strong>
                <p>{settings.bankOwner}</p>
                <div>
                  <span>{settings.bankAccount}</span>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(settings.bankAccount)
                        .then(() => setCopied(true))
                        .catch(() =>
                          toast.error(
                            "Bạn vui lòng sao chép số tài khoản thủ công",
                          ),
                        )
                    }
                  >
                    {copied ? "Đã sao chép" : "Sao chép"}
                  </button>
                </div>
                <p>
                  Nội dung: <strong>{order.code}</strong>
                </p>
                <p>
                  Chuyển đúng số tiền sau khi kiểm tra ưu đãi. Bấm “Tôi đã
                  chuyển khoản” trước khi hết giờ; tiệm sẽ tiếp tục giữ hàng để
                  đối soát.
                </p>
              </div>
            )}
          </section>
        </div>
        <aside>
          <section className="panel summary">
            <h2>Kiện gốm đang giữ</h2>
            {order.items.map((i) => (
              <div className="line-item mini" key={i.id}>
                <img src={i.image} alt={i.name} />
                <span>
                  {i.name}
                  <small>× {i.quantity}</small>
                </span>
                <strong>{money(i.unitPrice * i.quantity)}</strong>
              </div>
            ))}
            <hr />
            <label>
              Mã ưu đãi
              <input
                name="voucherCode"
                placeholder="Ví dụ: CHAOEM"
                maxLength={40}
                onChange={() => setQuote(null)}
              />
            </label>
            <button
              type="button"
              className="btn secondary full"
              disabled={busy}
              onClick={checkQuote}
            >
              Kiểm tra ưu đãi & tổng tiền
            </button>
            <div>
              <span>Tạm tính</span>
              <strong>{money(order.subtotal)}</strong>
            </div>
            <div>
              <span>Phí giao hàng</span>
              <strong>{money(quote?.shippingFee ?? shipping)}</strong>
            </div>
            <div>
              <span>Ưu đãi</span>
              <strong>−{money(quote?.discount || 0)}</strong>
            </div>
            <div className="summary-total">
              <span>
                Tổng cộng{!quote && <small>Chưa kiểm tra ưu đãi</small>}
              </span>
              <strong>{money(total)}</strong>
            </div>
            <label className="check-inline">
              <input type="checkbox" required />
              Tôi đồng ý{" "}
              <Link to="/chinh-sach" target="_blank">
                chính sách giao hàng & đổi trả
              </Link>
              .
            </label>
            <button
              className="btn full"
              disabled={
                busy || seconds === 0 || (payment === "TRANSFER" && !quote)
              }
            >
              {busy
                ? "Đang xác nhận…"
                : payment === "TRANSFER"
                  ? "Tôi đã chuyển khoản · Chờ xác nhận"
                  : payment === "VNPAY" ? "Tiếp tục thanh toán VNPay" : "Xác nhận đặt hàng COD"}
            </button>
            <p className="muted">
              Giá cuối cùng do hệ thống tính khi xác nhận đơn.
            </p>
          </section>
        </aside>
      </form>
    </div>
  );
}
