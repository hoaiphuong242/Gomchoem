export class SendgridDeliveryError extends Error {
  constructor(message: string, readonly permanent: boolean) { super(message); }
}

export async function sendgridError(response: Response) {
  const data = await response.json().catch(() => null) as { errors?: { message?: unknown }[] } | null;
  // Classify provider text, but never persist/log its raw body or addresses.
  const providerText = Array.isArray(data?.errors) ? data.errors.map(e => typeof e?.message === "string" ? e.message : "").join(" ").toLowerCase() : "";
  const status = response.status;
  let reason = "Dịch vụ gửi email chưa sẵn sàng; sẽ thử lại sau.";
  if (/verified sender|sender identity|sender.*not.*verified/.test(providerText)) reason = "SENDGRID_FROM_EMAIL chưa khớp địa chỉ đã xác minh trong SendGrid Sender Authentication.";
  else if (status === 401) reason = "SENDGRID_API_KEY không hợp lệ hoặc đã hết hiệu lực.";
  else if (/credit|quota|limit exceeded/.test(providerText)) reason = "Tài khoản SendGrid đã hết hạn mức gửi; kiểm tra gói dịch vụ.";
  else if (status === 403) reason = "SendGrid từ chối quyền gửi; kiểm tra quyền Mail Send và trạng thái tài khoản.";
  else if (status === 400 || status === 404) reason = "Cấu hình template hoặc dữ liệu email không hợp lệ; kiểm tra Dynamic Template đã kích hoạt.";
  else if (status === 429) reason = "SendGrid đang giới hạn tốc độ; hệ thống sẽ thử lại sau.";
  return new SendgridDeliveryError(`SendGrid HTTP ${status}: ${reason}`, status >= 400 && status < 500 && ![408, 429].includes(status));
}
