import { confirmAction } from "@/lib/confirm";
import { useState } from "react";

import { Check, Download, Search } from "lucide-react";
import { toast } from "sonner";

import { downloadInvoice, post, put } from "@/services/api/client";
import { date, money, eventMessage, statuses } from "@/lib/format";
import { Badge } from "@/components/common/ShopUI";

import OrderTable from "./OrderTable";
import Modal from "./Modal";
export default function Orders({ orders, refresh, user }) {
  const [filter, setFilter] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tracking, setTracking] = useState("");
  const [note, setNote] = useState("");
  const [refundConfirmed, setRefundConfirmed] = useState(false);
  const [refundAmount, setRefundAmount] = useState(0);
  const o = selected ? orders.find((i) => i.id === selected) : null;
  async function act(action) {
    if (
      action === "CONFIRM_PAYMENT" &&
      !(await confirmAction(
        "Bạn đã kiểm tra tiền thực nhận trong tài khoản ngân hàng?",
      ))
    )
      return;
    if (
      action === "CANCEL" &&
      !(await confirmAction(
        "Xác nhận hủy đơn? Hàng đã gửi chỉ nhập lại sau khi nhận thực tế.",
      ))
    )
      return;
    setBusy(true);
    try {
      await put(`/shop/admin/orders/${o.id}`, {
        action,
        trackingCode: tracking,
        note,
        refundConfirmed,
        refundAmount: Number(refundAmount),
      });
      refresh();
      toast.success("Đã cập nhật đơn hàng");
      setSelected(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-filters">
        <div className="catalog-search">
          <Search size={17} />
          <input
            placeholder="Tìm mã đơn, tên hoặc điện thoại"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Trạng thái đơn"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Tất cả trạng thái</option>
          {[
            "PENDING_PAYMENT",
            "CONFIRMED",
            "PACKING",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
            "EXPIRED",
          ].map((s) => (
            <option key={s} value={s}>
              {statuses[s]}
            </option>
          ))}
        </select>
      </div>
      <section className="panel">
        <OrderTable
          orders={orders.filter(
            (o) =>
              (!filter || o.status === filter) &&
              `${o.code} ${o.recipientName} ${o.phone}`
                .toLowerCase()
                .includes(query.toLowerCase()),
          )}
          select={(o) => {
            setSelected(o.id);
            setNote("");
            setTracking(o.trackingCode);
            setRefundConfirmed(false);
            setRefundAmount(o.total);
          }}
        />
      </section>
      {o && (
        <Modal title={`Đơn ${o.code}`} close={() => setSelected(null)}>
          <div className="order-title">
            <Badge status={o.status} />
            <span>
              {statuses[o.paymentStatus]} · {o.paymentMethod}
            </span>
          </div>
          <p>
            <strong>{o.recipientName}</strong> · {o.phone}
          </p>
          <p>{o.pickup ? "Nhận tại tiệm" : `${o.address}, ${o.city}`}</p>
          <p>
            {o.note}
            {o.giftWrap && " · Có gói quà"}
          </p>
          {o.items.map((i) => (
            <div className="line-item" key={i.id}>
              <img src={i.image} alt={i.name} />
              <div>
                <strong>{i.name}</strong>
                <small>
                  {i.sku} · {i.quantity} chiếc
                </small>
              </div>
              <strong>{money(i.unitPrice * i.quantity)}</strong>
            </div>
          ))}
          <div className="summary-total">
            <span>Tổng cộng</span>
            <strong>{money(o.total)}</strong>
          </div>
          <button
            className="btn secondary"
            onClick={() =>
              downloadInvoice(o.id).catch((e) => toast.error(e.message))
            }
          >
            <Download size={16} />
            In / tải bill PDF
          </button>
          <hr />
          {o.payment && <div className="notice"><strong>VNPay · {o.payment.status === "PAID" ? "Đã thanh toán" : o.payment.status === "FAILED" ? "Không thành công" : o.payment.status === "REVIEW" ? "Cần đối soát thủ công" : "Chờ cổng thanh toán xác nhận"}</strong><p>Hạn phiên: {date(o.payment.expiresAt)}{o.payment.transactionNo && ` · Mã giao dịch: ${o.payment.transactionNo}`}</p>{o.payment.status === "PENDING" && <p>Hệ thống tự kiểm tra VNPay. Không xác nhận tiền thủ công hoặc nhả hàng khi kết quả chưa rõ.</p>}</div>}
          {o.payment?.lastError && <div className="notice"><strong>Đối soát VNPay cần kiểm tra</strong><p>{o.payment.lastError}</p><p>Lần kiểm tra: {date(o.payment.lastCheckedAt)}. Lỗi này không tự xác nhận hay hủy thanh toán.</p></div>}
          {o.emails?.map(email => <div className="notice" key={email.id}>
            <strong>Email biên nhận · {email.status === "SENT" ? "Dịch vụ đã chấp nhận gửi" : email.status === "FAILED" ? "Gửi thất bại" : email.status === "SKIPPED" ? "Không gửi" : "Đang chờ gửi"}</strong>
            {email.sentAt && <p>{date(email.sentAt)}</p>}{email.lastError && <p>{email.lastError}</p>}
            {email.status === "FAILED" && user.role !== "WAREHOUSE" && <button className="btn secondary" disabled={busy} onClick={async () => {
              setBusy(true); try { await post(`/shop/admin/emails/${email.id}`); toast.success("Đã xếp hàng gửi lại email"); refresh(); } catch(e) { toast.error(e.message); } finally { setBusy(false); }
            }}>Thử gửi lại email</button>}
          </div>)}
          <label>
            Mã vận đơn
            <input
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              maxLength={100}
            />
          </label>
          <label>
            Ghi chú thao tác
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
            />
          </label>
          {o.paymentStatus === "PAID" && user.role === "ADMIN" && (
            <div className="notice">
              <label className="check-inline">
                <input
                  type="checkbox"
                  checked={refundConfirmed}
                  onChange={(e) => setRefundConfirmed(e.target.checked)}
                />
                Tôi đã hoàn tiền thực tế cho khách và xác nhận số tiền bên dưới
              </label>
              <label>
                Số tiền đã hoàn
                <input
                  type="number"
                  min="0"
                  max={o.total}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                />
              </label>
              <p>Hệ thống chỉ ghi nhận đối soát, không tự chuyển tiền.</p>
            </div>
          )}
          <div className="action-row">
            {o.status === "PENDING_PAYMENT" && o.paymentMethod === "TRANSFER" && user.role !== "WAREHOUSE" && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => act("CONFIRM_PAYMENT")}
              >
                <Check size={15} />
                Đã nhận tiền
              </button>
            )}
            {o.status === "CONFIRMED" && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => act("PACK")}
              >
                Bắt đầu đóng gói
              </button>
            )}
            {o.status === "PACKING" && !o.pickup && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => act("SHIP")}
              >
                Bàn giao vận chuyển
              </button>
            )}
            {(o.status === "SHIPPED" ||
              (o.pickup && ["CONFIRMED", "PACKING"].includes(o.status))) &&
              user.role !== "WAREHOUSE" && (
                <button
                  className="btn"
                  disabled={busy}
                  onClick={() => act("DELIVER")}
                >
                  Đã giao & thu đủ tiền
                </button>
              )}
            {["PENDING_PAYMENT", "CONFIRMED", "PACKING", "SHIPPED"].includes(
              o.status,
            ) &&
              !(o.paymentMethod === "VNPAY" && o.status === "PENDING_PAYMENT") &&
              user.role !== "WAREHOUSE" && (
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() => act("CANCEL")}
                >
                  Hủy đơn
                </button>
              )}
          </div>
          <div className="timeline">
            {o.events.map((ev) => (
              <div key={ev.id}>
                <span />
                <p>
                  {eventMessage(ev.message)}
                  <small>{date(ev.createdAt)}</small>
                </p>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}
