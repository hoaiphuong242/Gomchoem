import { Link } from "react-router-dom";

export default function Policies() {
  return (
    <div className="container section policy">
      <div className="eyebrow">MUA GỐM THẬT AN TÂM</div>
      <h1>Giao hàng & đổi trả</h1>
      <h2>Phí giao hàng</h2>
      <p>
        20.000đ trong Đà Nẵng và 35.000đ tại tỉnh/thành khác. Nhận trực tiếp tại
        tiệm không mất phí ship.
      </p>
      <h2>Giữ hàng & thanh toán</h2>
      <p>
        Thêm vào giỏ chưa giữ hàng. Vào thanh toán, hệ thống giữ số lượng đã
        chọn trong 3 phút. Hết giờ chưa chốt đơn thì hàng được mở bán lại. COD
        được chốt sau khi bạn xác nhận đặt hàng; đơn chuyển khoản được giữ khi
        bạn báo đã chuyển và chờ nhân viên đối soát.
      </p>
      <h2>Hủy đơn</h2>
      <p>
        Miễn phí trước khi bàn giao cho đơn vị vận chuyển. Sau khi bàn giao,
        người mua chịu phí ship. Đơn đã chuyển tiền cần liên hệ tiệm để đối soát
        hoàn tiền trước khi hủy.
      </p>
      <h2>Đổi trả trong 48 giờ</h2>
      <p>
        Tính từ lúc nhận hàng. Hàng còn nguyên vẹn có thể được xem xét đổi trả.
        Nếu gốm bị vỡ khi vận chuyển, vui lòng cung cấp video mở kiện để tiệm xử
        lý hoàn 100% tiền sản phẩm bị vỡ. Hàng chỉ được mở bán lại sau khi tiệm
        nhận và kiểm tra đạt tình trạng bán.
      </p>
      <h2>Biên nhận</h2>
      <p>
        Bạn có thể tải biên nhận PDF từ chi tiết đơn hàng. Biên nhận không thay
        thế hóa đơn điện tử có mã thuế.
      </p>
      <Link className="btn" to="/lien-he">
        Liên hệ tiệm
      </Link>
    </div>
  );
}
