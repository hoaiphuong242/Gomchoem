import {
  Heart,
  ShoppingBag,
  Package,
  ShieldCheck,
  Leaf,
  Gift,
  LoaderCircle,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCart, useAuth } from "@/stores/shop.store";
import { post } from "@/services/api/client";
import { money, statuses } from "@/lib/format";

export function Loading() {
  return (
    <div className="empty">
      <LoaderCircle className="spin" size={28} />
      <p>Tiệm đang chuẩn bị một chút…</p>
    </div>
  );
}
export function ErrorBox({ error }) {
  return (
    <div className="notice error" role="alert">
      {error?.message || "Có lỗi xảy ra, vui lòng tải lại trang."}
    </div>
  );
}
export function Empty({
  title = "Chưa có món gốm nào ở đây",
  text = "Ghé kệ gốm, biết đâu bạn gặp một món thật có duyên.",
}) {
  return (
    <div className="empty">
      <Package size={38} strokeWidth={1} />
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="btn" to="/san-pham">
        Ngắm kệ gốm
      </Link>
    </div>
  );
}
export function Badge({ status }) {
  return (
    <span className={`badge status-${status?.toLowerCase()}`}>
      {statuses[status] || status}
    </span>
  );
}
export function Benefits() {
  return (
    <div className="benefits">
      {[
        [Package, "Đóng gói thật nâng niu", "Bọc chống sốc cho từng món nhỏ."],
        [ShieldCheck, "An tâm khi nhận gốm", "Video mở kiện để bảo vệ bạn."],
        [
          Leaf,
          "Gốm xưa, câu chuyện mới",
          "Tuyển chọn và mô tả tình trạng thật.",
        ],
        [Gift, "Gửi một chút yêu thương", "Gói quà và lời nhắn dành riêng."],
      ].map(([Icon, title, text]) => (
        <div key={title}>
          <Icon strokeWidth={1.3} />
          <div>
            <strong>{title}</strong>
            <p>{text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
export function ProductCard({ product }) {
  const add = useCart((s) => s.add);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const sold = product.available <= 0;
  async function wish() {
    if (!user) return navigate("/dang-nhap");
    try {
      await post(`/shop/wishlist/${product.id}`);
      toast.success("Đã lưu vào những món bạn thương");
    } catch (e) {
      toast.error(e.message);
    }
  }
  return (
    <article className={`product-card ${sold ? "sold" : ""}`}>
      <div className="product-visual">
        <Link to={`/san-pham/${product.slug}`}>
          <img
            src={product.images?.[0]?.url}
            alt={product.name}
            loading="lazy"
          />
        </Link>
        <span className="product-tag">
          {sold
            ? "Sold out"
            : product.available === 1
              ? "Độc bản · 1 chiếc"
              : `Còn ${product.available} chiếc`}
        </span>
        <button
          className="icon-btn wish-btn"
          onClick={wish}
          aria-label={`Yêu thích ${product.name}`}
        >
          <Heart size={18} />
        </button>
      </div>
      <div className="product-info">
        <small>
          {product.category?.name} · {product.origin}
        </small>
        <Link to={`/san-pham/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p>
          {product.material} · {product.dimensions || "Gốm xưa tuyển chọn"}
        </p>
        <div className="product-bottom">
          <strong>{money(product.price)}</strong>
          <button
            disabled={sold}
            className="buy-small"
            onClick={() => {
              add(product);
              toast.success("Đã thêm vào giỏ gốm");
            }}
          >
            <ShoppingBag size={14} />
            {sold ? "Hết hàng" : "Thêm giỏ"}
          </button>
        </div>
      </div>
    </article>
  );
}
