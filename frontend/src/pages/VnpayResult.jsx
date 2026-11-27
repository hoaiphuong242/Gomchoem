import { useEffect } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { CheckCircle2, Clock, CircleAlert } from "lucide-react";
import { useAuth, useCart } from "@/stores/shop.store";
import { useRemote } from "@/hooks/useRemote";
import { ErrorBox, Loading } from "@/components/common/ShopUI";

export default function VnpayResult() {
  const { search } = useLocation();
  const user = useAuth(s => s.user);
  const clear = useCart(s => s.clear);
  const { data: result, error } = useRemote(user && search ? `/shop/payments/vnpay/return${search}` : null);
  const { data: order, error: orderError } = useRemote(user && result ? `/shop/orders/${result.orderId}` : null);
  const paid = order?.paymentStatus === "PAID";
  const failed = order?.payment?.status === "FAILED";
  const review = order?.payment?.status === "REVIEW";
  useEffect(() => {
    if (paid) { clear(); sessionStorage.removeItem("gce-reservation"); }
  }, [paid, clear]);
  if (!user) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(`/thanh-toan/vnpay/ket-qua${search}`)}`} replace />;
  if (!search || error) return <div className="container section"><ErrorBox error={error || new Error("Chưa có thông tin kết quả VNPay.")} /><Link className="btn" to="/tai-khoan">Xem đơn hàng của tôi</Link></div>;
  if (paid || (result?.status === "PAID" && result.paymentStatus === "PAID")) return <Navigate to={`/thanh-toan/thanh-cong/${result.orderId}`} replace />;
  if (orderError) return <div className="container section"><ErrorBox error={orderError} /></div>;
  if (!result || !order) return <Loading />;
  const Icon = paid ? CheckCircle2 : failed || review ? CircleAlert : Clock;
  return <div className="container section"><section className="panel payment-result">
    <Icon size={48} style={{ color: "var(--brown, #76583c)", margin: "16px auto" }} />
    <div className="eyebrow">KẾT QUẢ THANH TOÁN VNPAY</div>
    <h1>{paid ? "Tiệm đã nhận thanh toán" : failed ? "Thanh toán chưa thành công" : review ? "Tiệm đang kiểm tra giao dịch" : "Đang chờ VNPay xác nhận"}</h1>
    <p>Đơn hàng <strong>{order.code}</strong></p>
    <p>{paid ? "Cảm ơn bạn! Tiệm sẽ chuẩn bị kiện gốm và gửi biên nhận PDF đến email đăng ký của bạn." : failed ? "Phiên thanh toán đã kết thúc và hàng đã được mở bán lại. Bạn có thể quay lại giỏ để đặt lại." : review ? "Có khoản thanh toán cần đối soát với đơn đã kết thúc. Vui lòng liên hệ tiệm kèm mã đơn; đừng thanh toán thêm." : "Tiệm vẫn giữ hàng trong lúc kiểm tra kết quả. Trạng thái sẽ tự cập nhật tại đây. Nếu tài khoản đã bị trừ tiền, bạn đừng thanh toán thêm."}</p>
    <Link className="btn" to={`/don-hang/${order.id}`}>Xem chi tiết đơn hàng</Link>{failed && <> <Link className="btn secondary" to="/gio-hang">Về giỏ hàng</Link></>}
    {order.payment?.lastError && !failed && !review && <p className="muted">Kết nối đối soát với VNPay đang gián đoạn. Tiệm chưa nhận được kết quả có thể xác minh. Vui lòng không thanh toán lại; liên hệ tiệm kèm mã đơn nếu bạn đã bị trừ tiền.</p>}
    <p className="muted"><Link to="/lien-he">Liên hệ Gốm Cho Em</Link></p>
  </section></div>;
}
