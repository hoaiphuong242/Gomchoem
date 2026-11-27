import {
  Banknote,
  BarChart3,
  Boxes,
  MessageSquare,
  Package,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";

import { money } from "@/lib/format";

import OrderTable from "./OrderTable";
export default function Dashboard({ data, orders, setTab }) {
  const highest = Math.max(1, ...data.days.map((d) => d.revenue));
  return (
    <>
      <div className="admin-welcome">
        <div>
          <h2>Một ngày mới ở tiệm.</h2>
          <p>Cùng chăm chút những món gốm và từng đơn hàng.</p>
        </div>
        <span>
          {new Date().toLocaleDateString("vi-VN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="metric-grid">
        {[
          [
            Banknote,
            "Thu ròng sau hoàn tiền",
            money(data.revenue),
            "Từ các đơn đã thanh toán",
          ],
          [ShoppingBag, "Đơn hàng", data.orderCount, "Tổng đơn đã gửi"],
          [
            RefreshCw,
            "Chờ đối soát",
            data.pending,
            "Chuyển khoản cần kiểm tra",
          ],
          [Package, "Sản phẩm sắp hết", data.lowStock, "Còn tối đa một chiếc"],
        ].map(([Icon, title, value, hint]) => (
          <div className="metric" key={title}>
            <div>
              <span>{title}</span>
              <Icon size={18} />
            </div>
            <strong>{value}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="panel">
          <div className="section-heading">
            <h3>Tiền đã thu · 7 ngày gần đây</h3>
            <BarChart3 size={18} />
          </div>
          <div className="bar-chart">
            {data.days.map((d) => (
              <div key={d.day}>
                <span className="bar-value">{money(d.revenue)}</span>
                <div className="bar-track">
                  <span
                    style={{
                      height: `${Math.max(2, (d.revenue / highest) * 100)}%`,
                    }}
                  />
                </div>
                <small>{d.day.slice(5).split("-").reverse().join("/")}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="panel todo-panel">
          <h3>Tiệm cần chăm chút</h3>
          <button onClick={() => setTab("orders")}>
            <RefreshCw />
            <div>
              <strong>{data.pending} đơn chờ xác nhận tiền</strong>
              <p>Đối soát ngân hàng trước khi duyệt.</p>
            </div>
          </button>
          <button onClick={() => setTab("inventory")}>
            <Boxes />
            <div>
              <strong>{data.lowStock} mẫu sắp hết hàng</strong>
              <p>Kiểm tra kệ và nhập hàng khi cần.</p>
            </div>
          </button>
          <button onClick={() => setTab("inquiries")}>
            <MessageSquare />
            <div>
              <strong>
                {data.inquiries.filter((i) => !i.resolved).length} lời nhắn chưa
                xử lý
              </strong>
              <p>Gửi một chút quan tâm tới khách.</p>
            </div>
          </button>
        </section>
      </div>
      <section className="panel">
        <div className="section-heading">
          <h3>Những đơn gần đây</h3>
          <button className="text-link" onClick={() => setTab("orders")}>
            Xem tất cả
          </button>
        </div>
        <OrderTable orders={orders.slice(0, 6)} />
      </section>
    </>
  );
}
