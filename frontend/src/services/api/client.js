import { useAuth } from "@/stores/shop.store";
const base = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
export async function request(path, options = {}) {
  const token = sessionStorage.getItem("gce-token");
  const multipart = options.body instanceof FormData;
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      ...(options.body && !multipart
        ? { "Content-Type": "application/json" }
        : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    body:
      options.body && !multipart ? JSON.stringify(options.body) : options.body,
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    if (response.status === 401 && token) useAuth.getState().logout();
    const error = new Error(
      result.error?.details?.[0]?.message ||
        result.error?.message ||
        "Không thể kết nối với tiệm. Vui lòng thử lại.",
    );
    error.status = response.status;
    throw error;
  }
  return result.data;
}
export const get = (path) => request(path);
export const post = (path, body) => request(path, { method: "POST", body });
export const put = (path, body) => request(path, { method: "PUT", body });
export async function upload(file) {
  const form = new FormData();
  form.append("file", file);
  return post("/shop/uploads", form);
}
export async function downloadInvoice(id) {
  const response = await fetch(`${base}/shop/orders/${id}/invoice`, {
    headers: { Authorization: `Bearer ${sessionStorage.getItem("gce-token")}` },
  });
  if (!response.ok) throw new Error("Không tải được biên nhận");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `gomchoem-${id}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
