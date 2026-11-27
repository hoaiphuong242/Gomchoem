import { useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Search,
  ShoppingBag,
  UserRound,
  Camera as Instagram,
  Menu,
  X,
  MapPin,
} from "lucide-react";
import { useRemote } from "@/hooks/useRemote";
import { useCart } from "@/stores/shop.store";
import BrandLogo from "@/components/common/BrandLogo";
import NotificationCenter from "@/components/common/NotificationCenter";

export default function StoreLayout() {
  const [menu, setMenu] = useState(false);
  const [query, setQuery] = useState("");
  const items = useCart((s) => s.items);
  const navigate = useNavigate();
  const settings = useRemote("/shop/settings").data;
  return (
    <>
      <div className="announcement">
        Gốm xưa được nâng niu · Giao hàng toàn quốc · Đà Nẵng
      </div>
      <header className="site-header">
        <div className="header-inner">
          <Link to="/" className="brand">
            <BrandLogo />
            <span>
              gomchoem<small>ĐÀ NẴNG · VINTAGE POTTERY</small>
            </span>
          </Link>
          <nav className={menu ? "open" : ""} onClick={() => setMenu(false)}>
            <NavLink to="/" end>
              Trang chủ
            </NavLink>
            <NavLink to="/san-pham">Sản phẩm</NavLink>
            <NavLink to="/ve-tiem">Chuyện tiệm</NavLink>
            <NavLink to="/lien-he">Liên hệ</NavLink>
          </nav>
          <div className="header-tools">
            <NotificationCenter />
            <form
              className="search-inline"
              onSubmit={(e) => {
                e.preventDefault();
                navigate(`/san-pham?q=${encodeURIComponent(query)}`);
              }}
            >
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tìm một món gốm…"
                aria-label="Tìm sản phẩm"
              />
              <button aria-label="Tìm kiếm">
                <Search size={18} />
              </button>
            </form>
            <Link to="/gio-hang" className="icon-btn bag" aria-label="Giỏ hàng">
              <ShoppingBag size={21} />
              {items.length > 0 && (
                <b>{items.reduce((s, i) => s + i.quantity, 0)}</b>
              )}
            </Link>
            <Link to="/tai-khoan" className="icon-btn" aria-label="Tài khoản">
              <UserRound size={21} />
            </Link>
            <button
              className="icon-btn mobile-toggle"
              onClick={() => setMenu(!menu)}
              aria-label="Menu"
            >
              {menu ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <Link className="brand" to="/">
              <BrandLogo />gomchoem
            </Link>
            <p>
              Chắt chiu từng món gốm xưa,
              <br />
              để những ngày bình thường thêm dịu dàng.
            </p>
            <a
              href="https://www.instagram.com/gomchoem/"
              target="_blank"
              rel="noreferrer"
            >
              <Instagram size={16} /> @gomchoem
            </a>
          </div>
          <div>
            <h4>Ghé chơi tiệm</h4>
            <p>
              <MapPin size={14} /> Đà Nẵng
            </p>
            <p>{settings?.address || "Nhắn Instagram để nhận địa chỉ tiệm."}</p>
            {settings?.openingHours && <p>{settings.openingHours}</p>}
            {settings?.phone && (
              <a href={`tel:${settings.phone}`}>{settings.phone}</a>
            )}
            <Link to="/lien-he">Liên hệ với tiệm</Link>
          </div>
          <div>
            <h4>Một chút an tâm</h4>
            <Link to="/chinh-sach">Giao hàng & đổi trả</Link>
            <Link to="/tai-khoan">Theo dõi đơn hàng</Link>
            <p>
              Đóng gói nâng niu. Hỗ trợ đổi trả trong 48 giờ từ khi nhận hàng.
            </p>
          </div>
          <div>
            <h4>Kệ gốm của bạn</h4>
            <Link to="/san-pham">Tất cả sản phẩm</Link>
            <Link to="/gio-hang">Giỏ gốm đã chọn</Link>
            <Link to="/quan-tri">Dành cho nhân viên</Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© {new Date().getFullYear()} Gốm Cho Em</span>
          <span>Slow days. Thoughtful things.</span>
        </div>
      </footer>
    </>
  );
}
