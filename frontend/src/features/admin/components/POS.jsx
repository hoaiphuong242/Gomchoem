import { useState } from "react";

import { Download, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { downloadInvoice, post } from "@/services/api/client";
import { money } from "@/lib/format";

export default function POS({ products, refresh }) {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("STORE");
  const [busy, setBusy] = useState(false);
  const [bill, setBill] = useState(null);
  const [key, setKey] = useState(() => crypto.randomUUID());
  function add(p) {
    setItems((prev) =>
      prev.some((i) => i.productId === p.id)
        ? prev.map((i) =>
            i.productId === p.id
              ? { ...i, quantity: Math.min(p.available, i.quantity + 1) }
              : i,
          )
        : [
            ...prev,
            { productId: p.id, name: p.name, quantity: 1, price: p.price },
          ],
    );
  }
  async function submit(e) {
    e.preventDefault();
    if (!items.length) return toast.error("Chọn ít nhất một sản phẩm");
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    try {
      const o = await post("/shop/admin/pos", {
        requestKey: key,
        items: items.map(({ productId, quantity }) => ({
          productId,
          quantity,
        })),
        name: f.get("name"),
        phone: f.get("phone") || "",
        channel,
        paymentMethod: f.get("paymentMethod"),
        address: f.get("address") || "",
        city: f.get("city") || "",
        note: f.get("note") || "",
      });
      setBill(o);
      setItems([]);
      setKey(crypto.randomUUID());
      refresh();
      toast.success(
        channel === "STORE"
          ? "Đã thu tiền và xuất kho"
          : "Đã tạo đơn và giữ hàng",
      );
      form.reset();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="pos-grid">
        <section className="panel">
          <div className="catalog-search">
            <Search size={17} />
            <input
              placeholder="Tìm tên hoặc mã SKU"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="pos-products">
            {products
              .filter(
                (p) =>
                  p.active &&
                  `${p.name} ${p.sku}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              )
              .map((p) => (
                <button
                  key={p.id}
                  disabled={p.available <= 0}
                  onClick={() => add(p)}
                >
                  <img src={p.images[0]?.url} alt={p.name} />
                  <strong>{p.name}</strong>
                  <small>
                    {p.sku} · Còn {p.available}
                  </small>
                  <span>{money(p.price)}</span>
                </button>
              ))}
          </div>
        </section>
        <form className="panel pos-cart" onSubmit={submit}>
          <h2>Phiếu bán hàng</h2>
          <label>
            Kênh bán
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
            >
              <option value="STORE">Tại cửa hàng</option>
              <option value="FACEBOOK">Facebook · nhập thủ công</option>
              <option value="INSTAGRAM">Instagram · nhập thủ công</option>
            </select>
          </label>
          <label>
            Tên khách
            <input
              name="name"
              required
              defaultValue="Khách tại quầy"
              maxLength={100}
            />
          </label>
          <label>
            Điện thoại
            <input name="phone" required={channel !== "STORE"} maxLength={20} />
          </label>
          {channel !== "STORE" && (
            <>
              <label>
                Địa chỉ nhận hàng
                <input name="address" required minLength={5} maxLength={500} />
              </label>
              <label>
                Tỉnh / thành phố
                <input
                  name="city"
                  required
                  defaultValue="Đà Nẵng"
                  maxLength={100}
                />
              </label>
            </>
          )}
          {items.map((i) => (
            <div className="pos-line" key={i.productId}>
              <div>
                <strong>{i.name}</strong>
                <small>{money(i.price)}</small>
              </div>
              <input
                aria-label={`Số lượng ${i.name}`}
                type="number"
                min="1"
                max={products.find((p) => p.id === i.productId)?.available || 1}
                value={i.quantity}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((v) =>
                      v.productId === i.productId
                        ? { ...v, quantity: Number(e.target.value) }
                        : v,
                    ),
                  )
                }
              />
              <button
                type="button"
                className="icon-btn"
                onClick={() =>
                  setItems((prev) =>
                    prev.filter((v) => v.productId !== i.productId),
                  )
                }
                aria-label="Xóa"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          <div className="summary-total">
            <span>Tiền sản phẩm</span>
            <strong>
              {money(items.reduce((s, i) => s + i.quantity * i.price, 0))}
            </strong>
          </div>
          {channel !== "STORE" && (
            <p className="muted">
              Phí ship được tính tại server: 20k Đà Nẵng, 35k nơi khác.
            </p>
          )}
          <label>
            Thanh toán
            <select name="paymentMethod" key={channel}>
              {channel === "STORE" && (
                <option value="CASH">Tiền mặt · đã thu đủ</option>
              )}
              <option value="TRANSFER">
                Chuyển khoản
                {channel === "STORE"
                  ? " · đã kiểm tra tiền về"
                  : " · chờ đối soát"}
              </option>
              {channel !== "STORE" && <option value="COD">COD</option>}
            </select>
          </label>
          <label>
            Ghi chú
            <textarea name="note" maxLength={2000} />
          </label>
          {channel === "STORE" && (
            <label className="check-inline">
              <input type="checkbox" required />
              Tôi đã giao hàng và thu đủ tiền thực tế.
            </label>
          )}
          <button className="btn full" disabled={busy || !items.length}>
            {busy
              ? "Đang tạo đơn…"
              : channel === "STORE"
                ? "Hoàn tất bán & xuất bill"
                : "Tạo đơn online"}
          </button>
        </form>
      </div>
      {bill && (
        <div className="notice success">
          Đã tạo đơn <strong>{bill.code}</strong> · {money(bill.total)}{" "}
          <button
            className="text-link"
            onClick={() =>
              downloadInvoice(bill.id).catch((e) => toast.error(e.message))
            }
          >
            <Download size={16} />
            Tải / in bill PDF
          </button>
        </div>
      )}
    </>
  );
}
