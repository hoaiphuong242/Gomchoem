import { Link } from "react-router-dom";

import {
  ArrowUpRight,
  Check,
  ChevronRight,
  Camera as Instagram,
  ShieldCheck,
  ShoppingBag,
  Leaf,
} from "lucide-react";
import { useRemote } from "@/hooks/useRemote";

import {
  Benefits,
  ErrorBox,
  Loading,
  ProductCard,
} from "@/components/common/ShopUI";

const hero =
  "https://images.unsplash.com/photo-1493106641515-6b5631de4bb9?auto=format&fit=crop&w=1400&q=90";
export default function Home() {
  const { data, error } = useRemote("/shop/products?limit=6");
  return (
    <>
      <section className="home-hero container">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> MỘT CHÚT GỐM XƯA, MỘT CHÚT BÌNH YÊN
          </div>
          <h1>
            Gom nhặt những
            <br />
            ngày <em>thảnh thơi.</em>
          </h1>
          <p>
            Chiếc tách cũ, màu men mộc, một góc nhà thân quen.
            <br />
            Gốm Cho Em chắt chiu những món gốm secondhand
            <br className="desktop" /> để viết tiếp câu chuyện cùng bạn.
          </p>
          <div className="hero-actions">
            <Link className="btn" to="/san-pham">
              Khám phá kệ gốm <ArrowUpRight size={17} />
            </Link>
            <Link className="text-link" to="/ve-tiem">
              Chuyện của tiệm
            </Link>
          </div>
          <div className="hero-facts">
            <div>
              <strong>Tuyển chọn</strong>
              <small>Từng món bằng tay</small>
            </div>
            <div>
              <strong>Có một không hai</strong>
              <small>Mang nét men riêng</small>
            </div>
            <div>
              <strong>Nâng niu</strong>
              <small>Từ tiệm đến nhà bạn</small>
            </div>
          </div>
        </div>
        <div className="hero-photo">
          <img src={hero} alt="Bàn tay nâng niu những món gốm mộc" />
          <span className="photo-caption">
            Từ đất, từ lửa, từ những điều giản dị.
          </span>
          <div className="hero-stamp">
            gốm xưa
            <br />
            <i>cho em</i>
            <Leaf size={20} />
          </div>
        </div>
      </section>
      <div className="trust-strip">
        <div className="container">
          <span>
            <Check size={16} /> Gốm secondhand tuyển chọn
          </span>
          <span>
            <ShoppingBag size={16} /> Kho chung online & tại quầy
          </span>
          <span>
            <ShieldCheck size={16} /> Hỗ trợ khi vỡ do vận chuyển
          </span>
          <a href="https://www.instagram.com/gomchoem/">
            <Instagram size={16} /> Gặp tiệm trên Instagram
          </a>
        </div>
      </div>
      <section className="section container">
        <div className="section-heading">
          <div>
            <div className="eyebrow">TÌM MỘT MÓN THẬT CÓ DUYÊN</div>
            <h2>Gốm cho từng góc nhỏ.</h2>
          </div>
          <p>
            Một tách trà sáng, một bữa cơm nhà,
            <br />
            hay một cành hoa vừa ghé qua.
          </p>
        </div>
        <div className="category-grid">
          {[
            ["Chén & Tô", "chen-to", "01"],
            ["Đĩa gốm", "dia-gom", "02"],
            ["Muỗng & Thìa", "muong-thia", "03"],
            ["Ly & Tách", "ly-tach", "04"],
            ["Bình hoa", "binh-hoa", "05"],
          ].map(([name, slug], i) => (
            <Link to={`/san-pham?category=${slug}`} key={slug}>
              <span className={`category-art art-${i}`}>
                {["◡", "◉", "♧", "☕", "♙"][i]}
              </span>
              <strong>{name}</strong>
              <ChevronRight size={15} />
            </Link>
          ))}
        </div>
      </section>
      <section className="section container" id="ke-gom">
        <div className="section-heading">
          <div>
            <div className="eyebrow">KỆ GỐM HÔM NAY</div>
            <h2>Những món vừa dỡ kiện.</h2>
          </div>
          <Link className="text-link" to="/san-pham">
            Ngắm tất cả <ArrowUpRight size={16} />
          </Link>
        </div>
        {error ? (
          <ErrorBox error={error} />
        ) : !data ? (
          <Loading />
        ) : (
          <div className="product-grid">
            {data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
        <div className="gentle-note">
          <ShieldCheck size={19} />
          <p>
            Thêm giỏ để chọn món bạn thương. Tiệm chỉ bắt đầu giữ hàng{" "}
            <strong>3 phút khi bạn vào thanh toán.</strong>
          </p>
        </div>
      </section>
      <section className="story-section">
        <div className="container story-grid">
          <div className="story-image">
            <img
              src="https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=1000&q=85"
              alt="Những món gốm với sắc men ấm"
              loading="lazy"
            />
            <span>Mỗi vết men, một câu chuyện.</span>
          </div>
          <div>
            <div className="eyebrow">GÓC NHỎ CHUYỆN TIỆM</div>
            <h2>
              Đồ cũ, nhưng cảm giác
              <br />
              <em>luôn mới.</em>
            </h2>
            <p>
              Chúng mình tin rằng một chiếc đĩa đẹp có thể làm bữa cơm ngon hơn,
              một chiếc cốc vừa tay có thể khiến buổi sáng chậm lại.
            </p>
            <p>
              Gốm xưa không hoàn hảo không tì vết. Chính những nét men, dấu thời
              gian ấy làm mỗi món trở nên riêng biệt — như bạn.
            </p>
            <Link to="/ve-tiem" className="text-link">
              Đọc câu chuyện của tiệm <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </section>
      <section className="section container">
        <div className="section-heading">
          <div>
            <div className="eyebrow">MỘT CHÚT ĐỜI THƯỜNG</div>
            <h2>Hẹn bạn ở @gomchoem</h2>
          </div>
          <a
            className="text-link"
            href="https://www.instagram.com/gomchoem/"
            target="_blank"
            rel="noreferrer"
          >
            <Instagram size={17} /> Ghé Instagram
          </a>
        </div>
        <div className="instagram-grid">
          {[
            hero,
            "https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=600&q=85",
            "https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=85",
            "https://images.unsplash.com/photo-1578500494198-246f612d3b3d?auto=format&fit=crop&w=600&q=85",
          ].map((src, i) => (
            <a
              key={src}
              href="https://www.instagram.com/gomchoem/"
              target="_blank"
              rel="noreferrer"
            >
              <img
                src={src}
                alt={`Góc gốm mộc ${i + 1} · ảnh minh họa`}
                loading="lazy"
              />
              <Instagram />
            </a>
          ))}
        </div>
        <Benefits />
      </section>
    </>
  );
}
