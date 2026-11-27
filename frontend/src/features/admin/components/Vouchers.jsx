import { useState } from "react";

import { Plus } from "lucide-react";
import { toast } from "sonner";

import { post } from "@/services/api/client";
import { date, money } from "@/lib/format";

import Modal from "./Modal";
export default function Vouchers({ data, refresh }) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      await post("/shop/admin/vouchers", {
        code: f.get("code"),
        amount: Number(f.get("amount")),
        minTotal: Number(f.get("minTotal")),
        maxUses: Number(f.get("maxUses")),
        active: f.get("active") === "on",
        expiresAt: f.get("expiresAt")
          ? new Date(f.get("expiresAt")).toISOString()
          : null,
      });
      refresh();
      setEditing(null);
      toast.success("Đã lưu mã ưu đãi");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="btn" onClick={() => setEditing({})}>
        <Plus size={16} />
        Thêm mã ưu đãi
      </button>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Mã</th>
                <th>Giảm tiền</th>
                <th>Đơn tối thiểu</th>
                <th>Sử dụng</th>
                <th>Hạn dùng</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.vouchers.map((v) => (
                <tr key={v.code}>
                  <td>
                    {v.code}
                    <small>{v.active ? "Đang bật" : "Tạm tắt"}</small>
                  </td>
                  <td>{money(v.amount)}</td>
                  <td>{money(v.minTotal)}</td>
                  <td>
                    {v.used}/{v.maxUses}
                  </td>
                  <td>{v.expiresAt ? date(v.expiresAt) : "Không giới hạn"}</td>
                  <td>
                    <button className="text-link" onClick={() => setEditing(v)}>
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <Modal title="Mã ưu đãi" close={() => setEditing(null)}>
          <form onSubmit={submit}>
            <label>
              Mã
              <input
                name="code"
                required
                readOnly={!!editing.code}
                defaultValue={editing.code}
                pattern="[A-Za-z0-9_-]{3,40}"
              />
            </label>
            <label>
              Số tiền giảm
              <input
                name="amount"
                type="number"
                min="0"
                required
                defaultValue={editing.amount || 20000}
              />
            </label>
            <label>
              Đơn tối thiểu
              <input
                name="minTotal"
                type="number"
                min="0"
                required
                defaultValue={editing.minTotal || 0}
              />
            </label>
            <label>
              Lượt tối đa
              <input
                name="maxUses"
                type="number"
                min={Math.max(1, editing.used || 1)}
                required
                defaultValue={editing.maxUses || 100}
              />
            </label>
            <label>
              Hết hạn
              <input
                name="expiresAt"
                type="datetime-local"
                defaultValue={
                  editing.expiresAt
                    ? new Date(
                        new Date(editing.expiresAt).getTime() -
                          new Date().getTimezoneOffset() * 60000,
                      )
                        .toISOString()
                        .slice(0, 16)
                    : ""
                }
              />
            </label>
            <label className="check-inline">
              <input
                name="active"
                type="checkbox"
                defaultChecked={editing.active ?? true}
              />
              Đang bật
            </label>
            <button className="btn" disabled={busy}>
              Lưu mã
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
