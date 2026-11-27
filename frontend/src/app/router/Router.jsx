import AuthPage from "@/features/auth/components/AuthPage";
import {
  BrowserRouter,
  Link,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { useEffect } from "react";
import StoreLayout from "@/layouts/StoreLayout";
import {
  About,
  Catalog,
  Contact,
  Home,
  Policies,
  ProductDetail,
} from "@/pages/Storefront";
import { Account, OrderDetail } from "@/pages/Account";
import { Cart, Checkout } from "@/pages/Checkout";
import Admin from "@/pages/Admin";
import VnpayResult from "@/pages/VnpayResult";
import PaymentSuccess from "@/pages/PaymentSuccess";
import { NotificationRuntime } from "@/components/common/NotificationCenter";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
export default function Router() {
  return (
    <BrowserRouter>
      <NotificationRuntime />
      <ScrollToTop />
      <Routes>
        <Route element={<StoreLayout />}>
          <Route index element={<Home />} />
          <Route path="san-pham" element={<Catalog />} />
          <Route path="san-pham/:slug" element={<ProductDetail />} />
          <Route path="ve-tiem" element={<About />} />
          <Route path="lien-he" element={<Contact />} />
          <Route path="chinh-sach" element={<Policies />} />
          <Route path="gio-hang" element={<Cart />} />
          <Route path="thanh-toan" element={<Checkout />} />
          <Route path="thanh-toan/vnpay/ket-qua" element={<VnpayResult />} />
          <Route path="thanh-toan/thanh-cong/:id" element={<PaymentSuccess />} />
          <Route path="dang-nhap" element={<AuthPage />} />
          <Route path="tai-khoan" element={<Account />} />
          <Route path="don-hang/:id" element={<OrderDetail />} />
          <Route
            path="*"
            element={
              <div className="empty">
                <h1>Tiệm chưa có góc này.</h1>
                <Link className="btn" to="/">
                  Về trang chủ
                </Link>
              </div>
            }
          />
        </Route>
        <Route path="quan-tri" element={<Admin />} />
      </Routes>
    </BrowserRouter>
  );
}
