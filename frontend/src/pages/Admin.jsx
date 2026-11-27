import { useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import NotificationCenter from "@/components/common/NotificationCenter";
import { useNotifications } from "@/stores/notification.store";
import {
  Boxes,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  RefreshCw,
  Settings,
  ShoppingBag,
  Store,
  Tag,
  Users,
} from "lucide-react";

import { useRemote } from "@/hooks/useRemote";
import { useAuth } from "@/stores/shop.store";

import { roles } from "@/lib/format";
import { ErrorBox, Loading } from "@/components/common/ShopUI";
import BrandLogo from "@/components/common/BrandLogo";

import Dashboard from "@/features/admin/components/Dashboard";
import Orders from "@/features/admin/components/Orders";
import Products from "@/features/admin/components/Products";
import Inventory from "@/features/admin/components/Inventory";
import POS from "@/features/admin/components/POS";
import Returns from "@/features/admin/components/Returns";
import Inquiries from "@/features/admin/components/Inquiries";
import Vouchers from "@/features/admin/components/Vouchers";
import Staff from "@/features/admin/components/Staff";
import ShopSettings from "@/features/admin/components/ShopSettings";

const tabs = [
  [LayoutDashboard, "dashboard", "Tổng quan"],
  [ShoppingBag, "orders", "Đơn hàng"],
  [Package, "products", "Sản phẩm"],
  [Boxes, "inventory", "Tồn kho & nhập hàng"],
  [Store, "pos", "Bán hàng"],
  [RefreshCw, "returns", "Đổi trả & hoàn tiền"],
  [MessageSquare, "inquiries", "Hộp thư tiệm"],
  [Tag, "vouchers", "Mã ưu đãi"],
  [Users, "users", "Tài khoản & nhân viên"],
  [Settings, "settings", "Thông tin cửa hàng"],
];
const can = (user, tab) =>
  user.role === "ADMIN" ||
  (user.role === "CASHIER"
    ? ["dashboard", "orders", "products", "pos", "inquiries"].includes(tab)
    : ["dashboard", "orders", "products", "inventory"].includes(tab));

export default function Admin() {
  const user = useAuth((s) => s.user);
  const logout = useAuth((s) => s.logout);
  const [params, setParams] = useSearchParams();
  const requestedTab = params.get("tab") || "dashboard";
  const tab = user && can(user, requestedTab) && tabs.some(([, key]) => key === requestedTab) ? requestedTab : "dashboard";
  const setTab = value => setParams({ tab: value });
  const counts = useNotifications(s => s.data?.counts);
  const [menu, setMenu] = useState(false);
  const [version, setVersion] = useState(0);
  const { data, error } = useRemote(
    user && user.role !== "USER" ? "/shop/admin/dashboard" : null,
    version,
  );
  const orders = useRemote(
    user && user.role !== "USER" ? "/shop/admin/orders" : null,
    version,
  );
  const categories = useRemote("/shop/categories").data || [];
  const refresh = () => { setVersion((v) => v + 1); useNotifications.getState().refresh(); };
  if (!user) return <Navigate to="/dang-nhap?next=/quan-tri" replace />;
  if (user.role === "USER") return <Navigate to="/tai-khoan" replace />;
  return (
    <div className="admin-app">
      <aside className={`admin-sidebar ${menu ? "open" : ""}`}>
        <Link to="/" className="brand">
          <BrandLogo />gomchoem
        </Link>
        <span className="admin-label">GÓC QUẢN LÝ TIỆM</span>
        <nav>
          {tabs
            .filter(([, key]) => can(user, key))
            .map(([Icon, key, title]) => (
              <button
                key={key}
                className={key === tab ? "active" : ""}
                onClick={() => {
                  setTab(key);
                  setMenu(false);
                }}
              >
                <Icon size={18} />
                {title}
                {counts?.[key] > 0 && <b>{counts[key]}</b>}
              </button>
            ))}
        </nav>
        <div className="admin-user">
          <span className="avatar small">{user.name.slice(0, 1)}</span>
          <div>
            <strong>{user.name}</strong>
            <small>{roles[user.role]}</small>
          </div>
          <button className="icon-btn" aria-label="Đăng xuất" onClick={logout}>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-header">
          <button
            className="icon-btn mobile-toggle"
            onClick={() => setMenu(!menu)}
            aria-label="Menu quản trị"
          >
            <Menu />
          </button>
          <div>
            <span className="eyebrow">GỐM CHO EM / QUẢN TRỊ</span>
            <h1>{tabs.find(([, key]) => key === tab)?.[2]}</h1>
          </div>
          <div className="admin-header-actions">
            <NotificationCenter />
            <button className="btn secondary" onClick={refresh}>
              <RefreshCw size={15} />
              Làm mới
            </button>
            <Link className="text-link" to="/">
              Xem cửa hàng
            </Link>
          </div>
        </header>
        <div className="admin-content">
          {error ? (
            <ErrorBox error={error} />
          ) : !data ? (
            <Loading />
          ) : (
            <>
              {tab === "dashboard" && (
                <Dashboard
                  data={data}
                  orders={orders.data || []}
                  setTab={setTab}
                />
              )}
              {tab === "orders" && (
                <Orders
                  orders={orders.data || []}
                  refresh={refresh}
                  user={user}
                />
              )}
              {tab === "products" && (
                <Products
                  data={data}
                  categories={categories}
                  refresh={refresh}
                  user={user}
                />
              )}
              {tab === "inventory" && (
                <Inventory data={data} refresh={refresh} user={user} />
              )}
              {tab === "pos" && (
                <POS products={data.inventory} refresh={refresh} />
              )}
              {tab === "returns" && <Returns data={data} refresh={refresh} />}
              {tab === "inquiries" && (
                <Inquiries data={data} refresh={refresh} />
              )}
              {tab === "vouchers" && <Vouchers data={data} refresh={refresh} />}
              {tab === "users" && (
                <Staff data={data} refresh={refresh} user={user} />
              )}
              {tab === "settings" && <ShopSettings />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
