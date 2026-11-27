import { useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

import { toast } from "sonner";

import { useAuth } from "@/stores/shop.store";
import { post } from "@/services/api/client";
import BrandLogo from "@/components/common/BrandLogo";

export default function AuthPage() {
  const [register, setRegister] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const login = useAuth((s) => s.login);
  const user = useAuth((s) => s.user);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnPath = params.get("next") || "";
  const paymentReturn = /^\/thanh-toan\/(?:vnpay\/ket-qua(?:\?|$)|thanh-cong\/[a-f0-9-]{36}$)/.test(returnPath) ? returnPath : null;
  const destinationFor = (account) =>
    account.role === "USER" ? paymentReturn || "/" : "/quan-tri";
  if (user) return <Navigate to={destinationFor(user)} replace />;
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      if (register) await post("/auth/register", data);
      const session = await post("/auth/login", {
        email: data.email,
        password: data.password,
      });
      login(session);
      toast.success(register ? "Chào bạn mới của tiệm!" : "Mừng bạn ghé lại");
      navigate(destinationFor(session.user), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="auth-page container">
      <div className="auth-story">
        <div className="eyebrow">MỘT GÓC NHỎ DÀNH RIÊNG CHO BẠN</div>
        <h1>
          Chào bạn,
          <br />
          <em>người thương gốm.</em>
        </h1>
        <p>
          Lưu những món bạn thích, theo dõi kiện hàng
          <br />
          và cùng tiệm gom thêm những ngày bình yên.
        </p>
        <div className="auth-photo">
          <img
            src="https://images.unsplash.com/photo-1514228742587-6b1558fcca3d?auto=format&fit=crop&w=800&q=85"
            alt="Một tách gốm chờ bạn"
          />
        </div>
      </div>
      <form className="panel auth-form" onSubmit={submit}>
        <BrandLogo className="auth-logo" />
        <h2>{register ? "Làm quen với tiệm" : "Mừng bạn ghé lại"}</h2>
        <p className="muted">
          {register
            ? "Tạo tài khoản để bắt đầu câu chuyện gốm của bạn."
            : "Đăng nhập vào góc gốm của riêng mình."}
        </p>
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        {register && (
          <label>
            Họ và tên
            <input name="name" required maxLength={100} autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label htmlFor="auth-password" className="password-label">
          Mật khẩu
        </label>
        <div className="password-field">
          <input
            id="auth-password"
            name="password"
            type={showPassword ? "text" : "password"}
            minLength={8}
            maxLength={72}
            required
            autoComplete={register ? "new-password" : "current-password"}
          />
          <button
            type="button"
            className="password-toggle icon-btn"
            aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
            aria-pressed={showPassword}
            aria-controls="auth-password"
            onClick={() => setShowPassword((value) => !value)}
          >
            {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
        </div>
        <button className="btn full" disabled={busy}>
          {busy ? "Đang kết nối…" : register ? "Tạo tài khoản" : "Đăng nhập"}
        </button>
        <p className="auth-switch">
          {register ? "Đã là bạn của tiệm?" : "Lần đầu ghé chơi?"}{" "}
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setRegister(!register);
              setError("");
              setShowPassword(false);
            }}
          >
            {register ? "Đăng nhập" : "Tạo tài khoản"}
          </button>
        </p>
      </form>
    </div>
  );
}
