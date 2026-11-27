import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  Headphones,
  ImagePlus,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Phone,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRemote } from "@/hooks/useRemote";
import { useAuth } from "@/stores/shop.store";
import { post, upload } from "@/services/api/client";
import "@/styles/contact.css";

const instagram = "https://www.instagram.com/gomchoem/";
const topics = [
  "Tư vấn món gốm độc bản",
  "Tìm dáng gốm xưa theo yêu cầu",
  "Hẹn ghé thăm tiệm & uống trà",
  "Gói quà tặng & thiệp viết tay",
  "Đơn hàng & đổi trả",
  "Lời nhắn khác",
];
const moments = [
  "Kệ tách gốm trong nắng sớm",
  "Một bình hoa, một tách trà",
  "Góc tiệm ấm ánh đèn",
  "Gói ghém một chút yêu thương",
];
export default function Contact() {
  const settings = useRemote("/shop/settings").data;
  const user = useAuth((s) => s.user);
  const address =
    settings?.address || "654/11A Trưng Nữ Vương, Hải Châu, Đà Nẵng";
  const phone = settings?.phone;
  const map = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Gốm Cho Em, ${address}`)}`;
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  function selectFile(selected) {
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      toast.error("Chọn ảnh JPG, PNG hoặc WebP nhé.");
      return;
    }
    if (selected.size > 15 * 1024 * 1024) {
      toast.error("Ảnh tham khảo tối đa 15MB nhé.");
      return;
    }
    setFile(selected);
    setSent(false);
  }
  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError("");
    setSent(false);
    try {
      if (file && !user)
        throw new Error(
          "Bạn đăng nhập để gửi kèm ảnh, hoặc bỏ ảnh để gửi lời nhắn nhé.",
        );
      const imageUrl = file ? (await upload(file)).url : "";
      await post("/shop/inquiries", {
        name: data.get("name").trim(),
        phone: data.get("phone").trim(),
        email: data.get("email").trim(),
        topic: data.get("topic"),
        message: data.get("message").trim(),
        imageUrl,
      });
      setSent(true);
      setFile(null);
      form.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="contact-page">
      <section className="ct-main">
        <div className="ct-wrap">
          <nav className="ct-breadcrumb" aria-label="Đường dẫn">
            <Link to="/">Trang chủ</Link>
            <ChevronRight size={12} />
            <span>LIÊN HỆ & GHÉ TIỆM</span>
          </nav>
          <header className="ct-heading">
            <span className="ct-eyebrow">
              KẾT NỐI & GHÉ CHƠI CÙNG GỐM CHO EM
            </span>
            <h1>
              Gửi chút tâm tình hoặc ghé tiệm
              <br className="ct-desktop-break" /> uống tách trà ấm
            </h1>
            <p>
              Dù bạn muốn hỏi thăm một chiếc tách men rạn, đặt tìm món gốm xưa
              hay chỉ đơn giản muốn ghé thăm góc nhỏ của tiệm tại Đà Nẵng, chúng
              mình luôn sẵn lòng đón bạn.
            </p>
          </header>
          <div className="ct-grid">
            <section
              className="ct-card ct-form-card"
              aria-labelledby="ct-form-title"
            >
              <div className="ct-card-top">
                <span className="ct-eyebrow">
                  <MessageCircle size={15} />
                  HỘP THƯ GỐM MỘC
                </span>
                <span className="ct-small-note">
                  <span />
                  Tiệm luôn lắng nghe
                </span>
              </div>
              <h2 id="ct-form-title">Gửi tin nhắn hoặc yêu cầu tìm gốm</h2>
              <p className="ct-form-intro">
                Bạn có thể gửi hình chiếc tách bạn thích, hoặc chia sẻ góc nhà
                đang cần một bình hoa dáng mộc.
              </p>
              {sent && (
                <div className="ct-feedback ct-success" role="status">
                  <CheckCircle2 size={22} />
                  <div>
                    <strong>Tiệm đã nhận lời nhắn của bạn!</strong>
                    <p>
                      Chúng mình sẽ liên hệ qua thông tin bạn để lại. Cảm ơn bạn
                      đã thương gốm.
                    </p>
                  </div>
                </div>
              )}
              {error && (
                <div className="ct-feedback ct-error" role="alert">
                  {error}
                </div>
              )}
              <form onSubmit={submit}>
                <fieldset disabled={busy}>
                  <div className="ct-fields">
                    <label htmlFor="ct-name">
                      Họ và tên của bạn *
                      <input
                        id="ct-name"
                        name="name"
                        required
                        maxLength={100}
                        autoComplete="name"
                        defaultValue={user?.name || ""}
                        placeholder="Tiệm gọi bạn là…"
                      />
                    </label>
                    <label htmlFor="ct-phone">
                      Số điện thoại / Zalo *
                      <input
                        id="ct-phone"
                        name="phone"
                        type="tel"
                        required
                        maxLength={20}
                        autoComplete="tel"
                        placeholder="Số để tiệm nhắn bạn"
                      />
                    </label>
                    <label htmlFor="ct-email">
                      Email liên hệ
                      <input
                        id="ct-email"
                        name="email"
                        type="email"
                        maxLength={254}
                        autoComplete="email"
                        defaultValue={user?.email || ""}
                        placeholder="ban@email.com"
                      />
                    </label>
                    <label htmlFor="ct-topic">
                      Bạn đang quan tâm đến
                      <select id="ct-topic" name="topic">
                        {topics.map((topic) => (
                          <option key={topic}>{topic}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="ct-message-label" htmlFor="ct-message">
                    <span>
                      Lời nhắn gửi cho tiệm <b>*</b>
                    </span>
                    <small>Kích cỡ, màu men, mục đích…</small>
                  </label>
                  <textarea
                    id="ct-message"
                    name="message"
                    required
                    maxLength={5000}
                    rows={5}
                    placeholder="Chia sẻ những điều bạn đang tìm kiếm hoặc một lời hẹn ghé tiệm nhé…"
                  />
                  <div className="ct-upload-heading">
                    Ảnh tham khảo mẫu bạn ưng ý <span>(nếu có)</span>
                  </div>
                  <div
                    className={`ct-upload ${dragging ? "is-dragging" : ""}`}
                    onDragOver={(event) => {
                      event.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(event) => {
                      event.preventDefault();
                      setDragging(false);
                      if (!busy) selectFile(event.dataTransfer.files[0]);
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => fileInput.current?.click()}
                      aria-describedby="ct-upload-help"
                    >
                      <ImagePlus size={30} strokeWidth={1.4} />
                      <strong>
                        {file ? file.name : "Tải ảnh lên hoặc kéo thả vào đây"}
                      </strong>
                      <span>
                        {file
                          ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Nhấn để chọn ảnh khác`
                          : "Định dạng JPG, PNG, WEBP (tối đa 15MB)"}
                      </span>
                    </button>
                    <input
                      ref={fileInput}
                      className="ct-hidden-input"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label="Chọn ảnh tham khảo"
                      onChange={(event) => {
                        selectFile(event.target.files[0]);
                        event.target.value = "";
                      }}
                    />
                    {file && (
                      <button
                        type="button"
                        className="ct-remove-file"
                        onClick={() => setFile(null)}
                        aria-label="Bỏ ảnh đã chọn"
                      >
                        <X size={17} />
                      </button>
                    )}
                  </div>
                  <p id="ct-upload-help" className="ct-upload-help">
                    {user ? (
                      "Ảnh giúp tiệm hiểu rõ hơn món gốm bạn đang tìm."
                    ) : (
                      <>
                        <Link to="/dang-nhap">Đăng nhập</Link> để gửi kèm ảnh.
                        Bạn vẫn có thể gửi lời nhắn mà không cần tài khoản.
                      </>
                    )}
                  </p>
                  <div className="ct-submit-row">
                    <button className="ct-button" disabled={busy}>
                      <span>
                        {busy
                          ? "Đang gửi lời nhắn…"
                          : "Gửi lời nhắn cho Gomchoem"}
                      </span>
                      <Send size={17} />
                    </button>
                    <span className="ct-privacy">
                      <ShieldCheck size={16} />
                      Thông tin chỉ dùng để liên hệ
                    </span>
                  </div>
                  <p className="ct-form-note">
                    Tiệm sẽ phản hồi qua thông tin bạn để lại trong giờ làm
                    việc. Nếu cần hỗ trợ sớm, bạn có thể{" "}
                    {phone
                      ? "gọi hotline trực tiếp."
                      : "nhắn Instagram cho tiệm nhé."}
                  </p>
                </fieldset>
              </form>
            </section>
            <aside className="ct-side">
              <section className="ct-card ct-invitation">
                <span className="ct-eyebrow">LỜI MỜI TỪ TIỆM</span>
                <h2>
                  Ghé chơi, ngắm gốm &<br /> uống tách trà ấm
                </h2>
                <p>
                  Tiệm nằm trong con hẻm của đường Trưng Nữ Vương. Nếu bạn ở Đà
                  Nẵng hoặc có dịp ghé thăm thành phố biển, mời bạn tạt vào chơi
                  và chậm rãi ngắm những món gốm xưa.
                </p>
                <div className="ct-details">
                  <div>
                    <span className="ct-detail-icon">
                      <MapPin size={18} />
                    </span>
                    <div>
                      <h3>{address}</h3>
                      <p>Một góc nhỏ tại Đà Nẵng, chờ bạn ghé thăm.</p>
                    </div>
                  </div>
                  <div>
                    <span className="ct-detail-icon">
                      <Clock size={18} />
                    </span>
                    <div>
                      <h3>
                        {settings?.openingHours ||
                          "Nhắn tiệm trước khi ghé chơi"}
                      </h3>
                      <p>Tiệm sẽ xác nhận giờ đón bạn qua Instagram.</p>
                    </div>
                  </div>
                  <div>
                    <span className="ct-detail-icon">
                      <Phone size={18} />
                    </span>
                    <div>
                      <h3>
                        {phone ? (
                          <a href={`tel:${phone}`}>Hotline / Zalo: {phone}</a>
                        ) : (
                          "Cần tiệm hỗ trợ?"
                        )}
                      </h3>
                      <p>
                        {phone
                          ? "Nhắn tin trước để chúng mình chuẩn bị đón bạn."
                          : "Nhắn Instagram để được tư vấn và hướng dẫn đường đi."}
                      </p>
                    </div>
                  </div>
                  <div>
                    <span className="ct-detail-icon">
                      <Camera size={18} />
                    </span>
                    <div>
                      <h3>
                        <a href={instagram} target="_blank" rel="noreferrer">
                          Instagram: @gomchoem
                        </a>
                      </h3>
                      <p>Nhật ký gốm mộc, những góc men và chuyện tiệm.</p>
                    </div>
                  </div>
                </div>
                <div className="ct-invitation-actions">
                  <a
                    className="ct-button"
                    href={map}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <Navigation size={15} />
                    Chỉ đường Google Maps
                  </a>
                  <a
                    className="ct-button ct-button-soft"
                    href={instagram}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle size={15} />
                    Nhắn tiệm trước khi ghé
                  </a>
                </div>
              </section>
              <section className="ct-card ct-directions">
                <div className="ct-card-top">
                  <span className="ct-eyebrow">
                    <BookOpen size={16} />
                    HÀNH TRÌNH CHẬM RÃI
                  </span>
                  <span className="ct-direction-badge">
                    Một góc Đà Nẵng thân quen
                  </span>
                </div>
                <h2>Bốn bước chạm ngõ tiệm gốm yên bình</h2>
                <ol>
                  {[
                    "Mở bản đồ và tìm Gốm Cho Em.",
                    "Tìm đến con hẻm Trưng Nữ Vương.",
                    "Nhắn tiệm nếu bạn cần chỉ đường.",
                    "Ghé chơi, ngắm gốm và chọn món thương.",
                  ].map((step, i) => (
                    <li key={step}>
                      <span>0{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <a href={map} target="_blank" rel="noreferrer">
                  Để bản đồ dẫn bạn tới tiệm <ArrowUpRight size={15} />
                </a>
              </section>
            </aside>
          </div>
        </div>
      </section>
      <section className="ct-channels">
        <div className="ct-wrap">
          <span className="ct-eyebrow">KÊNH TRỰC TIẾP</span>
          <h2>Chăm chút từng đơn hàng & cuộc trò chuyện</h2>
          <div className="ct-channel-grid">
            <article className="ct-card ct-channel">
              <span className="ct-channel-icon">
                <Headphones size={25} />
              </span>
              <span className="ct-eyebrow">TRỰC TIẾP CÙNG TIỆM</span>
              <h3>Tư vấn Zalo / Hotline</h3>
              <strong>{phone || "Nhắn tiệm để được tư vấn"}</strong>
              <p>
                Hỏi thêm về một góc men, xem cận cảnh món gốm bạn thích và kiểm
                tra số lượng trước khi chọn mua.
              </p>
              <a
                href={phone ? `tel:${phone}` : instagram}
                {...(!phone ? { target: "_blank", rel: "noreferrer" } : {})}
              >
                {phone ? "Gọi ngay cho tiệm" : "Nhắn tiệm trên Instagram"}
                <ArrowRight size={15} />
              </a>
            </article>
            <article className="ct-card ct-channel">
              <span className="ct-channel-icon ct-icon-gold">
                <Camera size={25} />
              </span>
              <span className="ct-eyebrow">CỘNG ĐỒNG YÊU GỐM</span>
              <h3>Instagram Story & Video</h3>
              <strong>@gomchoem</strong>
              <p>
                Ghé xem những kiện gốm mới, góc phối bàn trà bình dị và những
                câu chuyện nho nhỏ trong ngày của tiệm.
              </p>
              <a href={instagram} target="_blank" rel="noreferrer">
                Ghé thăm Instagram
                <ArrowRight size={15} />
              </a>
            </article>
            <article className="ct-card ct-channel">
              <span className="ct-channel-icon">
                <PackageCheck size={25} />
              </span>
              <span className="ct-eyebrow">CAM KẾT VẬN CHUYỂN</span>
              <h3>Đóng gói an tâm từng chuyến đi</h3>
              <strong>Hỗ trợ hoàn 100% khi vỡ do ship</strong>
              <p>
                Gốm được bọc chống sốc cẩn thận. Giữ video mở kiện và liên hệ
                tiệm trong 48 giờ từ lúc nhận hàng để được hỗ trợ.
              </p>
              <Link to="/chinh-sach">
                Chính sách giao hàng & đổi trả
                <ArrowRight size={15} />
              </Link>
            </article>
          </div>
        </div>
      </section>
      <section className="ct-moments">
        <div className="ct-wrap">
          <div className="ct-moments-heading">
            <div>
              <span className="ct-eyebrow">GÓC NHỎ ĐÀ NẴNG</span>
              <h2>Những khoảnh khắc tại Gomchoem</h2>
            </div>
            <span>{address}</span>
          </div>
          <div className="ct-photo-strip">
            {moments.map((caption, index) => (
              <figure key={caption}>
                <img
                  src={`/contact/moment-${index + 1}.jpg`}
                  alt={caption}
                  width="400"
                  height="400"
                  loading="lazy"
                />
                <figcaption>{caption}</figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
