export const money = (value) =>
  `${Number(value || 0).toLocaleString("vi-VN")}đ`;
export const date = (value) =>
  value ? new Date(value).toLocaleString("vi-VN") : "—";
export const statuses = {
  RESERVED: "Đang giữ hàng",
  EXPIRED: "Hết hạn giữ hàng",
  PENDING_PAYMENT: "Chờ đối soát",
  CONFIRMED: "Đã xác nhận",
  PACKING: "Đang đóng gói",
  SHIPPED: "Đang giao hàng",
  DELIVERED: "Đã nhận hàng",
  CANCELLED: "Đã hủy",
  REQUESTED: "Chờ duyệt",
  APPROVED: "Đã duyệt",
  REJECTED: "Từ chối",
  RECEIVED: "Đã nhận lại",
  PAID: "Đã thanh toán",
  UNPAID: "Chưa thanh toán",
  AWAITING_REVIEW: "Chờ xác nhận tiền",
  REFUNDED: "Đã ghi nhận hoàn tiền",
};
export const roles = {
  ADMIN: "Chủ tiệm",
  CASHIER: "Thu ngân",
  WAREHOUSE: "Nhân viên kho",
  USER: "Khách hàng",
};

export const eventMessage = message => message.replace(/^(PACKING|SHIPPED|DELIVERED|CANCELLED)/, value => statuses[value] || value);
