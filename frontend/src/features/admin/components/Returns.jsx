import { confirmAction } from "@/lib/confirm";
import { useState } from "react";

import { toast } from "sonner";
import { useRemote } from "@/hooks/useRemote";

import { post, put, upload } from "@/services/api/client";
import { date, money, statuses } from "@/lib/format";
import { Badge } from "@/components/common/ShopUI";

export default function Returns({ data, refresh }) {
  const { data: returnOrders } = useRemote("/shop/admin/orders");
  const [busy, setBusy] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  async function create(e) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      let evidence = f.get("evidence");
      const file = f.get("file");
      if (file?.size) evidence = (await upload(file)).url;
      await post("/shop/admin/returns", {
        orderId: f.get("orderId"),
        reason: f.get("reason"),
        evidence,
      });
      refresh();
      setShowCreate(false);
      toast.success("Đã tạo yêu cầu tiếp nhận hàng");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function submit(e, r) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (
      f.get("action") === "RECEIVE" &&
      !(await confirmAction(
        "Bạn đã nhận và kiểm tra hàng? Nếu ghi số tiền hoàn, xác nhận đã hoàn tiền thực tế cho khách.",
      ))
    )
      return;
    setBusy(true);
    try {
      await put(`/shop/admin/returns/${r.id}`, {
        action: f.get("action"),
        restock: f.get("restock") === "on",
        refund: Number(f.get("refund") || 0),
        note: f.get("note"),
      });
      refresh();
      toast.success("Đã cập nhật yêu cầu");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="notice">
        Chỉ nhập lại kho khi đã nhận và kiểm tra hàng nguyên vẹn. Hàng vỡ không
        được mở bán lại. Tiền hoàn tại đây là ghi nhận sau khi chủ tiệm hoàn
        tiền thực tế.
      </div>
      <button
        className="btn secondary"
        onClick={() => setShowCreate(!showCreate)}
      >
        Tạo yêu cầu cho đơn POS / đơn hàng hoàn về
      </button>
      {showCreate && (
        <form className="panel" onSubmit={create}>
          <h3>Tiếp nhận đổi trả tại tiệm</h3>
          <label>
            Chọn đơn hàng
            <select name="orderId" required>
              {(returnOrders || [])
                .filter((o) => ["DELIVERED", "CANCELLED"].includes(o.status))
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.code} · {o.recipientName} · {statuses[o.status]}
                  </option>
                ))}
            </select>
          </label>
          <label>
            Lý do
            <textarea name="reason" required />
          </label>
          <label>
            Ảnh / video kiểm tra hàng
            <input
              name="file"
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm"
            />
          </label>
          <label>
            Hoặc liên kết bằng chứng
            <input name="evidence" type="url" />
          </label>
          <button className="btn" disabled={busy}>
            Tạo yêu cầu
          </button>
        </form>
      )}
      {!data.returns.length && (
        <div className="panel">Chưa có yêu cầu đổi trả.</div>
      )}
      {data.returns.map((r) => (
        <section className="panel" key={r.id}>
          <div className="order-title">
            <h3>{r.order.code}</h3>
            <Badge status={r.status} />
          </div>
          <p>{r.reason}</p>
          <a
            className="text-link"
            href={r.evidence}
            target="_blank"
            rel="noreferrer"
          >
            Xem video / bằng chứng
          </a>
          <p className="muted">
            {date(r.createdAt)} · Giá trị đơn {money(r.order.total)}
          </p>
          {["REQUESTED", "APPROVED"].includes(r.status) ? (
            <form onSubmit={(e) => submit(e, r)}>
              <div className="form-grid">
                <label>
                  Thao tác
                  <select name="action">
                    {r.status === "REQUESTED" ? (
                      <>
                        <option value="APPROVE">Duyệt tiếp nhận</option>
                        <option value="REJECT">Từ chối</option>
                      </>
                    ) : (
                      <option value="RECEIVE">
                        Đã nhận / kiểm tra · ghi nhận hoàn tiền
                      </option>
                    )}
                  </select>
                </label>
                {r.status === "APPROVED" && (
                  <label>
                    Tiền đã hoàn cho khách
                    <input
                      type="number"
                      name="refund"
                      min="0"
                      max={r.order.total}
                      defaultValue={
                        r.order.paymentStatus === "PAID" ? r.order.total : 0
                      }
                    />
                  </label>
                )}
              </div>
              {r.status === "APPROVED" && (
                <label className="check-inline">
                  <input type="checkbox" name="restock" />
                  Đã kiểm tra nguyên vẹn, nhập lại toàn bộ sản phẩm của đơn
                </label>
              )}
              <label>
                Ghi chú kết quả
                <textarea name="note" required maxLength={2000} />
              </label>
              <button className="btn" disabled={busy}>
                Lưu xử lý
              </button>
            </form>
          ) : (
            <p>
              {r.staffNote} · Đã hoàn {money(r.refund)}
            </p>
          )}
        </section>
      ))}
    </>
  );
}
