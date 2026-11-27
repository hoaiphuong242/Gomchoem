import { useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ChevronRight,
  Heart,
  Camera as Instagram,
  Minus,
  Plus,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { useRemote } from "@/hooks/useRemote";
import { useAuth, useCart } from "@/stores/shop.store";
import { post } from "@/services/api/client";
import { money } from "@/lib/format";
import {
  Benefits,
  ErrorBox,
  Loading,
  ProductCard,
} from "@/components/common/ShopUI";

export default function ProductDetail() {
  const { slug } = useParams();
  const { data: p, error } = useRemote(`/shop/products/${slug}`);
  const related = useRemote("/shop/products?limit=4").data;
  const [image, setImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const add = useCart((s) => s.add);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [reviewVersion, setReviewVersion] = useState(0);
  const reviewData = useRemote(`/shop/products/${slug}`, reviewVersion).data;
  const [busy, setBusy] = useState(false);
  if (error)
    return (
      <div className="container section">
        <ErrorBox error={error} />
      </div>
    );
  if (!p) return <Loading />;
  async function wish() {
    if (!user) return navigate("/dang-nhap");
    try {
      await post(`/shop/wishlist/${p.id}`);
      toast.success("Đã lưu món gốm");
    } catch (e) {
      toast.error(e.message);
    }
  }
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link to="/">Trang chủ</Link>
        <ChevronRight size={13} />
        <Link to="/san-pham">Sản phẩm</Link>
        <ChevronRight size={13} />
        {p.name}
      </div>
      <div className="detail-grid">
        <div>
          <div className="detail-photo">
            <img src={p.images[image]?.url || p.images[0]?.url} alt={p.name} />
            <span>Rê chuột để ngắm kỹ nét men</span>
          </div>
          <div className="thumbnails">
            {p.images.map((im, i) => (
              <button
                key={im.id}
                className={i === image ? "active" : ""}
                onClick={() => setImage(i)}
              >
                <img src={im.url} alt={`Góc nhìn ${i + 1}`} />
              </button>
            ))}
          </div>
          <p className="muted">
            <ShieldCheck size={14} /> Ảnh sản phẩm và mô tả tình trạng do tiệm
            cung cấp.
          </p>
        </div>
        <div className="detail-copy">
          <div className="eyebrow">
            {p.category.name} · {p.sku}
          </div>
          <h1>{p.name}</h1>
          <p className="detail-description">{p.description}</p>
          <div className="detail-price">
            {money(p.price)} <small>/ chiếc</small>
          </div>
          <div
            className={`availability ${p.available <= 0 ? "unavailable" : ""}`}
          >
            <span />
            {p.available > 0
              ? `Còn ${p.available} chiếc có thể đặt`
              : "Sold out · Hẹn bạn một món gốm khác"}
          </div>
          <div className="detail-purchase">
            <div className="quantity">
              <button
                disabled={quantity <= 1}
                onClick={() => setQuantity(quantity - 1)}
                aria-label="Giảm số lượng"
              >
                <Minus size={15} />
              </button>
              <span>{quantity}</span>
              <button
                disabled={quantity >= p.available}
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Tăng số lượng"
              >
                <Plus size={15} />
              </button>
            </div>
            <button
              className="btn"
              disabled={p.available <= 0}
              onClick={() => {
                add(p, quantity);
                toast.success("Đã thêm vào giỏ");
              }}
            >
              <ShoppingBag size={17} />
              Thêm vào giỏ
            </button>
          </div>
          <button
            className="btn secondary full"
            disabled={p.available <= 0}
            onClick={() => {
              add(p, quantity);
              navigate("/gio-hang");
            }}
          >
            Mua ngay
          </button>
          <div className="detail-links">
            <button className="text-link" onClick={wish}>
              <Heart size={17} /> Lưu vào những món bạn thương
            </button>
            <a
              href="https://www.instagram.com/gomchoem/"
              target="_blank"
              rel="noreferrer"
            >
              <Instagram size={17} /> Nhắn tiệm soi men
            </a>
          </div>
          <div className="gentle-note">
            <ShieldCheck size={20} />
            <p>
              Giỏ hàng chưa giữ sản phẩm. Khi sang thanh toán, tiệm giữ riêng
              cho bạn trong <strong>3 phút</strong>.
            </p>
          </div>
          <div className="spec-table">
            {[
              ["Xuất xứ", p.origin],
              ["Chất liệu", p.material],
              ["Kích thước", p.dimensions || "Liên hệ tiệm"],
              ["Tình trạng", p.conditionDetail],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{label}</strong>
                <p>{value}</p>
              </div>
            ))}
          </div>
          {[
            [
              "Chăm sóc món gốm",
              "Rửa nhẹ bằng miếng mềm, lau khô sau khi dùng. Không dùng lò vi sóng hoặc máy rửa bát nếu tiệm chưa xác nhận phù hợp.",
            ],
            [
              "Giao hàng & đổi trả",
              "Phí ship 20.000đ trong Đà Nẵng, 35.000đ ngoài thành phố. Đổi trả trong 48 giờ từ khi nhận hàng. Vui lòng quay video mở kiện.",
            ],
          ].map(([title, body]) => (
            <details key={title}>
              <summary>{title}</summary>
              <p>{body}</p>
            </details>
          ))}
        </div>
      </div>
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">CHUYỆN TỪ NGƯỜI DÙNG GỐM</div>
            <h2>Những lời nhắn nhỏ.</h2>
          </div>
        </div>
        <div className="reviews">
          {(reviewData || p).reviews?.map((r) => (
            <div key={r.id} className="review">
              <strong>{r.user.name}</strong>
              <span>{"★".repeat(r.rating)}</span>
              <p>{r.content}</p>
            </div>
          ))}
          {!(reviewData || p).reviews?.length && (
            <p className="muted">Món gốm đang đợi câu chuyện đầu tiên.</p>
          )}
        </div>
        {user && (
          <form
            className="review-form"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const f = new FormData(e.currentTarget);
              try {
                await post(`/shop/products/${slug}/reviews`, {
                  rating: Number(f.get("rating")),
                  content: f.get("content"),
                });
                setReviewVersion((v) => v + 1);
                toast.success("Cảm ơn lời nhắn của bạn");
              } catch (err) {
                toast.error(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              Đánh giá sau khi nhận hàng
              <select name="rating">
                <option value="5">5 sao</option>
                <option value="4">4 sao</option>
                <option value="3">3 sao</option>
                <option value="2">2 sao</option>
                <option value="1">1 sao</option>
              </select>
            </label>
            <label>
              Lời nhắn
              <textarea
                name="content"
                required
                maxLength={2000}
                placeholder="Chia sẻ cảm nhận về món gốm…"
              />
            </label>
            <button className="btn" disabled={busy}>
              Gửi đánh giá
            </button>
          </form>
        )}
      </section>
      <section className="section">
        <div className="section-heading">
          <h2>Có thể bạn cũng thương.</h2>
          <Link to="/san-pham" className="text-link">
            Xem kệ gốm
          </Link>
        </div>
        <div className="product-grid four">
          {related?.items
            .filter((i) => i.id !== p.id)
            .slice(0, 4)
            .map((i) => (
              <ProductCard key={i.id} product={i} />
            ))}
        </div>
      </section>
      <Benefits />
    </div>
  );
}
