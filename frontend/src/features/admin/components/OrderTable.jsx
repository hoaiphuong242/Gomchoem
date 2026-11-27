import { date, money, statuses } from "@/lib/format";
import { Badge } from "@/components/common/ShopUI";

export default function OrderTable({ orders, select }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Mã đơn</th>
            <th>Khách hàng</th>
            <th>Kênh</th>
            <th>Trạng thái</th>
            <th>Tổng tiền</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <strong>{o.code}</strong>
                <small>{date(o.submittedAt || o.createdAt)}</small>
              </td>
              <td>
                {o.recipientName}
                <small>{o.phone}</small>
              </td>
              <td>{o.channel}</td>
              <td>
                <Badge status={o.status} />
                <small>{statuses[o.paymentStatus]}</small>
              </td>
              <td>{money(o.total)}</td>
              <td>
                {select && (
                  <button className="text-link" onClick={() => select(o)}>
                    Chi tiết
                  </button>
                )}
              </td>
            </tr>
          ))}
          {!orders.length && (
            <tr>
              <td colSpan={6}>Chưa có đơn hàng.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
