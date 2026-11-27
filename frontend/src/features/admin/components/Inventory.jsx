import { useState } from "react";

import { toast } from "sonner";

import { post } from "@/services/api/client";
import { date } from "@/lib/format";

export default function Inventory({ data, refresh, user }) {
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await post("/shop/admin/stock", {
        productId: f.get("productId"),
        quantity: Number(f.get("quantity")),
        type: f.get("type"),
        note: f.get("note"),
      });
      refresh();
      toast.success("Đã ghi sổ và cập nhật tồn kho");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="dashboard-grid">
        <form className="panel" onSubmit={submit}>
          <h2>Ghi phiếu nhập / điều chỉnh</h2>
          <label>
            Sản phẩm
            <select name="productId" required>
              {data.inventory.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.sku} · {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Loại nghiệp vụ
              <select name="type">
                <option value="IMPORT">Nhập hàng</option>
                {user.role === "ADMIN" && (
                  <option value="ADJUSTMENT">Điều chỉnh kiểm kho</option>
                )}
              </select>
            </label>
            <label>
              Số lượng tăng / giảm
              <input
                name="quantity"
                type="number"
                required
                min={user.role === "ADMIN" ? -10000 : 1}
                max="10000"
                defaultValue="1"
              />
            </label>
          </div>
          <label>
            Nhà cung cấp / lý do / mã đơn liên quan
            <textarea
              name="note"
              required
              maxLength={1000}
              placeholder="Ghi rõ để đối chiếu lịch sử kho"
            />
          </label>
          <button className="btn" disabled={busy}>
            Ghi nhận vào kho
          </button>
        </form>
        <section className="panel">
          <h2>Kho chung · một nguồn tồn</h2>
          <p>
            Hàng đang giữ thuộc phiên checkout hoặc đơn chưa xuất. Khi bàn giao
            vận chuyển, hệ thống trừ hàng thực có.
          </p>
          <div className="notice">
            <strong>Có thể bán = thực có − đang giữ</strong>
            <p>
              Không nhập lại hàng hủy đã giao shipper cho tới khi tiệm nhận hàng
              thực tế. Ghi phiếu điều chỉnh kèm mã đơn sau khi kiểm tra.
            </p>
          </div>
        </section>
      </div>
      <section className="panel">
        <h3>Tồn kho theo mẫu</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Thực có</th>
                <th>Đang giữ</th>
                <th>Có thể bán</th>
              </tr>
            </thead>
            <tbody>
              {data.inventory.map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.name}
                    <small>{p.sku}</small>
                  </td>
                  <td>{p.inventory?.onHand || 0}</td>
                  <td>{p.inventory?.reserved || 0}</td>
                  <td>
                    <strong>{p.available}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h3>Sổ biến động kho</h3>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Thời gian</th>
                <th>Sản phẩm</th>
                <th>Loại</th>
                <th>Biến động</th>
                <th>Người thực hiện</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((e) => (
                <tr key={e.id}>
                  <td>{date(e.createdAt)}</td>
                  <td>{e.product.name}</td>
                  <td>{e.type}</td>
                  <td>
                    {e.quantity > 0 ? "+" : ""}
                    {e.quantity}
                  </td>
                  <td>{e.actor?.name || "Hệ thống"}</td>
                  <td>{e.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
