import { toast } from "sonner";

import { put } from "@/services/api/client";
import { date } from "@/lib/format";

export default function Inquiries({ data, refresh }) {
  return (
    <div className="inquiry-grid">
      {!data.inquiries.length && (
        <div className="panel">Hộp thư chưa có lời nhắn.</div>
      )}
      {data.inquiries.map((i) => (
        <section key={i.id} className="panel">
          <div className="order-title">
            <h3>{i.topic}</h3>
            <span className="badge">
              {i.resolved ? "Đã xử lý" : "Chờ phản hồi"}
            </span>
          </div>
          <p>
            <strong>{i.name}</strong> · {i.phone}
          </p>
          <p>{i.email}</p>
          <p className="inquiry-message">{i.message}</p>
          {i.imageUrl && (
            <a href={i.imageUrl} target="_blank" rel="noreferrer">
              <img
                className="inquiry-image"
                src={i.imageUrl}
                alt="Ảnh khách gửi"
              />
            </a>
          )}
          <p className="muted">{date(i.createdAt)}</p>
          {!i.resolved && (
            <button
              className="btn secondary"
              onClick={async () => {
                try {
                  await put(`/shop/admin/inquiries/${i.id}`);
                  refresh();
                } catch (e) {
                  toast.error(e.message);
                }
              }}
            >
              Đã liên hệ & xử lý
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
