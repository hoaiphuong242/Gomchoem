import { useEffect } from "react";
import { CheckCircle2, Download, Package } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useRemote } from "@/hooks/useRemote";
import { useAuth, useCart } from "@/stores/shop.store";
import { downloadInvoice } from "@/services/api/client";
import { money } from "@/lib/format";
import { ErrorBox, Loading } from "@/components/common/ShopUI";

export default function PaymentSuccess() {
  const { id } = useParams();
  const user = useAuth(s => s.user);
  const clear = useCart(s => s.clear);
  const { data: order, error } = useRemote(user ? `/shop/orders/${id}` : null);
  const paid = order?.paymentStatus === "PAID";
  useEffect(() => {
    if (paid) { clear(); sessionStorage.removeItem("gce-reservation"); }
  }, [paid, clear]);
  if (!user) return <Navigate to={`/dang-nhap?next=${encodeURIComponent(`/thanh-toan/thanh-cong/${id}`)}`} replace />;
  if (error) return <div className="container section"><ErrorBox error={error} /></div>;
  if (!order) return <Loading />;
  if (!paid || order.payment?.status === "REVIEW") return <Navigate to={`/don-hang/${id}`} replace />;
  return <div className="container section">
    <section className="panel payment-result payment-success" aria-labelledby="payment-success-title">
      <div className="payment-success-icon"><CheckCircle2 size={46} aria-hidden="true" /></div>
      <div className="eyebrow">CẢM ƠN BẠN ĐÃ THƯƠNG GỐM</div>
      <h1 id="payment-success-title">Thanh toán thành công!</h1>
      <p>Tiệm đã nhận thanh toán cho đơn <strong>{order.code}</strong>.<br />Những món gốm bạn chọn sẽ sớm được gói ghém thật nâng niu.</p>
      <div className="payment-receipt">
        <div><span>Tổng đã thanh toán</span><strong>{money(order.total)}</strong></div>
        <div><span>Phương thức</span><strong>{order.paymentMethod === "VNPAY" ? "VNPay" : "Chuyển khoản"}</strong></div>
        {order.payment?.transactionNo && <div><span>Mã giao dịch</span><strong>{order.payment.transactionNo}</strong></div>}
      </div>
      <p className="muted">Biên nhận PDF sẽ được gửi đến email đăng ký của bạn. Bạn cũng có thể tải ngay bên dưới.</p>
      <div className="payment-result-actions">
        <Link className="btn" to={`/don-hang/${order.id}`}><Package size={17} />Theo dõi đơn hàng</Link>
        <button className="btn secondary" onClick={() => downloadInvoice(order.id).catch(e => toast.error(e.message))}><Download size={17} />Tải biên nhận PDF</button>
      </div>
      <Link className="text-link" to="/san-pham">Tiếp tục ngắm gốm</Link>
    </section>
  </div>;
}
