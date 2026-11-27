import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen,
  CheckCircle2,
  Copy,
  Flower2,
  Footprints,
  HandHeart,
  Heart,
  Camera,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  ShieldCheck,
  Sparkles,
  Store,
  Clock,
  ArrowUpRight,
} from "lucide-react";
import { toast } from "sonner";
import { useRemote } from "@/hooks/useRemote";
import { post } from "@/services/api/client";
import "@/styles/about.css";

const instagram = "https://www.instagram.com/gomchoem/";
const defaultAddress = "654/11A Trưng Nữ Vương, Hải Châu, Đà Nẵng";
const journal = [
  {
    image: "pottery-bowl",
    tag: "Họa tiết thủ công",
    category: "GỐM NHẬT SƯU TẦM",
    detail: "Nét men thân quen",
    title: "Tô men kem cánh sóng & nét vẽ xưa",
    text: "Cầm vừa vặn trong lòng bàn tay, từng nét hoa nhỏ trên nền men kem mang cảm giác thân thương như món quà từ tuổi thơ.",
  },
  {
    image: "pottery-noel",
    tag: "Một chút không khí lễ hội",
    category: "ĐĨA NỔI RETRO",
    detail: "Kiện Noel",
    title: "Đĩa gốm nổi viền sọc kẹo gậy",
    text: "Lớp men bóng và những đường nét phù điêu rực rỡ. Một chiếc đĩa nhỏ để bày bánh quy, cũng đủ làm ấm cả bàn tiệc gia đình.",
  },
  {
    image: "pottery-oignon",
    tag: "Men màu đất nung",
    category: "ÂU SÚP RETRO",
    detail: "Dày dặn & mộc mạc",
    title: "Âu chữ nổi Oignon cổ điển",
    text: "Màu men hồng đất đầm ấm, nét chữ nổi và đôi quai nhỏ xinh. Một món gốm có duyên cho những bữa ăn quây quần.",
  },
];
const values = [
  {
    Icon: Heart,
    title: "Vẻ đẹp bất toàn & Độc bản",
    text: "Một vệt men loang, một dấu triện nhỏ hay sắc màu đã đi qua năm tháng. Mỗi món gốm mang một nét riêng, để bạn tìm thấy điều mình thương trong những điều giản dị.",
    detail: "Mỗi sản phẩm là một câu chuyện riêng",
    DetailIcon: CheckCircle2,
  },
  {
    Icon: HandHeart,
    title: "Tuyển chọn & Chăm chút tận tay",
    text: "Từng chiếc âu, đĩa hoa, ly tách đều được tiệm lựa chọn và kiểm tra kỹ. Tình trạng secondhand, nét men và những khuyết điểm được mô tả để bạn chọn món thật an tâm.",
    detail: "Nâng niu từ lúc chọn đến khi gửi",
    DetailIcon: Sparkles,
  },
  {
    Icon: ShieldCheck,
    title: "Đóng gói an tâm từng chuyến đi",
    text: "Gốm được bọc chống sốc cẩn thận trước khi gửi đến bạn. Nếu gốm vỡ khi vận chuyển, tiệm hỗ trợ hoàn 100% tiền khi có video mở kiện, trong 48 giờ từ lúc nhận hàng.",
    detail: "Gói ghém cẩn thận, hỗ trợ tận tình",
    DetailIcon: PackageCheck,
  },
];
export default function About() {
  const settings = useRemote("/shop/settings").data;
  const address = settings?.address || defaultAddress;
  const hours = settings?.openingHours || "Nhắn tiệm trước khi ghé chơi nhé";
  const mapQuery = encodeURIComponent(`Gốm Cho Em, ${address}`);
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  async function subscribe(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const email = new FormData(form).get("email").trim();
    setBusy(true);
    try {
      await post("/shop/inquiries", {
        name: "Bạn đăng ký nhận tin gốm",
        phone: "Không cung cấp",
        email,
        topic: "Đăng ký nhận thông báo kiện gốm mới",
        message:
          "Tôi đồng ý để Gốm Cho Em liên hệ qua email này khi có kiện gốm mới. Yêu cầu đăng ký từ trang Chuyện tiệm.",
        imageUrl: "",
      });
      setSubscribed(true);
      form.reset();
    } catch (error) {
      toast.error(error.message);
    } finally {
      setBusy(false);
    }
  }
  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      toast.success("Đã sao chép địa chỉ tiệm");
    } catch {
      toast.error("Bạn có thể chọn và sao chép địa chỉ bên trên nhé.");
    }
  }
  return (
    <div className="about-page">
      <section className="about-hero">
        <div className="about-wrap">
          <div className="about-kicker">
            <Flower2 size={16} />
            <span>GÓC CHUYỆN TRÒ</span>
            <b aria-hidden="true">·</b>Đà Nẵng, những ngày chậm rãi
          </div>
          <div className="about-hero-grid">
            <div className="about-hero-copy">
              <h1>
                Nhặt nhạnh những ngày thảnh thơi cùng <em>gốm xưa</em>
              </h1>
              <p>
                Giữa lòng phố thị nhộn nhịp, tiệm gốm nhỏ nép mình nơi con hẻm{" "}
                <strong>{address}</strong>. Chúng mình tin rằng mỗi chiếc đĩa
                mộc, chiếc chén nhỏ hay tách trà đều có một câu chuyện chờ người
                thương đón về.
              </p>
              <div className="about-actions">
                <a className="about-button" href="#loi-moi-ghe-tiem">
                  <Footprints size={18} />
                  Ghé Chơi Tiệm
                </a>
                <a className="about-button about-button-light" href="#triet-ly">
                  <BookOpen size={17} />
                  Chuyện Gốm & Triết Lý
                </a>
              </div>
              <div className="about-stats">
                <div>
                  <strong>Gốm xưa</strong>
                  <span>MỘT ĐỜI SỐNG MỚI</span>
                </div>
                <div>
                  <strong>100%</strong>
                  <span>TUYỂN CHỌN TAY</span>
                </div>
                <div>
                  <strong>Nâng niu</strong>
                  <span>ĐÓNG GÓI AN TÂM</span>
                </div>
              </div>
            </div>
            <div className="about-logo-mood">
              <div className="about-logo-card">
                <div className="about-logo-image">
                  <img
                    src="/about/logo-reference.jpg"
                    alt="Gomchoem Đà Nẵng — tiệm gốm xưa"
                    width="400"
                    height="400"
                  />
                </div>
                <div className="about-logo-caption">
                  <div>
                    <strong>Slow Days & Vintage Pottery</strong>
                    <span>Một chút gốm, một chút bình yên</span>
                  </div>
                  <Flower2 size={22} />
                </div>
              </div>
              <span className="about-location-stamp">
                <MapPin size={16} />
                Đà Nẵng, một góc nhỏ thương quen
              </span>
            </div>
          </div>
        </div>
      </section>
      <section className="about-journal about-section">
        <div className="about-wrap">
          <div className="about-section-intro">
            <div>
              <span className="about-eyebrow">HÀNH TRÌNH TUYỂN GỐM</span>
              <h2>
                Từng kiện gốm dỡ ra,
                <br />
                từng niềm vui bất ngờ
              </h2>
            </div>
            <p>
              Mỗi chuyến hàng về là một ngày tiệm hồi hộp đón những món gốm mộc
              mạc. Có những nét men rất lạ, cũng có những món vừa nhìn đã thấy
              thân quen.
            </p>
          </div>
          <div className="about-photo-grid">
            {journal.map((item) => (
              <article className="about-photo-card" key={item.image}>
                <div className="about-photo">
                  <img
                    src={`/about/${item.image}.jpg`}
                    alt={item.title}
                    width="400"
                    height="500"
                    loading="lazy"
                  />
                  <span>{item.tag}</span>
                </div>
                <div className="about-photo-copy">
                  <div className="about-photo-meta">
                    <span>{item.category}</span>
                    <span>{item.detail}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p>{item.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="about-values about-section" id="triet-ly">
        <div className="about-wrap">
          <div className="about-centered-heading">
            <span className="about-eyebrow">GIÁ TRỊ GỬI TRAO</span>
            <h2>3 Điều Giữ Trọn Lòng Tin</h2>
            <p>
              Tụi mình không xem gốm chỉ là hàng hóa, mà là sự chuyển giao của
              kỷ niệm và những rung cảm dịu dàng trong căn bếp của bạn.
            </p>
          </div>
          <div className="about-value-grid">
            {values.map(({ Icon, title, text, detail, DetailIcon }, index) => (
              <article className="about-value-card" key={title}>
                <span className="about-value-icon">
                  <Icon size={26} strokeWidth={1.5} />
                </span>
                <span className="about-value-number">
                  TRIẾT LÝ 0{index + 1}
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
                <div className="about-value-detail">
                  <DetailIcon size={17} />
                  <span>{detail}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="about-section about-studio">
        <div className="about-wrap">
          <div className="about-studio-card">
            <div>
              <span className="about-eyebrow">KHÔNG GIAN CỦA NẮNG & GỖ</span>
              <h2>Một chốn nhỏ để lòng dịu lại sau ngày dài</h2>
              <p>
                Tiệm nhỏ ở Trưng Nữ Vương không cần quá nhiều vội vã. Những
                chiếc kệ đầy gốm, một góc ánh sáng ấm và những sắc men xưa đang
                chờ bạn ghé ngắm. Dù chọn mua hay chỉ tìm chút cảm hứng cho căn
                nhà, cứ chậm rãi chơi cùng tiệm nhé.
              </p>
              <div className="about-studio-notes">
                <div>
                  <strong>Ghé chậm một chút</strong>
                  <span>Ngắm kỹ từng nét men</span>
                </div>
                <div>
                  <strong>Mang thương về nhà</strong>
                  <span>Chọn món gốm dành cho bạn</span>
                </div>
              </div>
            </div>
            <figure>
              <img
                src="/about/shop-interior.jpg"
                alt="Không gian tiệm gốm ấm áp với kệ gỗ và ánh đèn dịu"
                width="700"
                height="440"
                loading="lazy"
              />
              <figcaption>
                <span />
                Một góc gốm ấm, chờ bạn ghé chơi
              </figcaption>
            </figure>
          </div>
        </div>
      </section>
      <section className="about-visit about-section" id="loi-moi-ghe-tiem">
        <div className="about-wrap about-visit-grid">
          <div className="about-visit-card">
            <div>
              <span className="about-eyebrow">
                <Store size={17} />
                CHỈ ĐƯỜNG TỚI TIỆM
              </span>
              <h2>
                Ghé Tiệm Uống Trà,
                <br />
                Lựa Gốm
              </h2>
              <p>
                Một tiệm gốm nhỏ trong con hẻm Trưng Nữ Vương. Nhắn tiệm trước
                khi ghé, chúng mình sẽ chỉ đường và cùng bạn tìm những món gốm
                thật có duyên.
              </p>
              <div className="about-contact-list">
                <div>
                  <MapPin size={22} />
                  <div>
                    <h3>Địa chỉ tiệm</h3>
                    <p>{address}</p>
                  </div>
                </div>
                <div>
                  <Clock size={22} />
                  <div>
                    <h3>Thời gian đón bạn</h3>
                    <p>{hours}</p>
                  </div>
                </div>
                <div>
                  <Phone size={22} />
                  <div>
                    <h3>
                      {settings?.phone
                        ? "Hotline / Zalo hỗ trợ"
                        : "Nhắn tiệm để được hỗ trợ"}
                    </h3>
                    {settings?.phone ? (
                      <a href={`tel:${settings.phone}`}>{settings.phone}</a>
                    ) : (
                      <a href={instagram} target="_blank" rel="noreferrer">
                        Instagram: @gomchoem <ArrowUpRight size={13} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="about-actions">
              <a
                className="about-button"
                href={instagram}
                target="_blank"
                rel="noreferrer"
              >
                <Camera size={17} />
                Instagram: @gomchoem
              </a>
              <button
                className="about-button about-button-light"
                onClick={copyAddress}
              >
                <Copy size={16} />
                Sao chép địa chỉ
              </button>
            </div>
          </div>
          <div className="about-map">
            <iframe
              title="Bản đồ chỉ đường đến Gốm Cho Em, Đà Nẵng"
              src={`https://maps.google.com/maps?q=${mapQuery}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
            <a
              className="about-map-card"
              href={`https://www.google.com/maps/search/?api=1&query=${mapQuery}`}
              target="_blank"
              rel="noreferrer"
            >
              <span className="about-map-icon">
                <Store size={24} />
              </span>
              <span>
                <strong>Gốm Cho Em Studio</strong>
                <span>{address}</span>
                <b>
                  Mở bản đồ & chỉ đường <ArrowUpRight size={14} />
                </b>
              </span>
            </a>
          </div>
        </div>
      </section>
      <section className="about-newsletter about-section">
        <div className="about-wrap">
          <Mail size={32} strokeWidth={1.5} />
          <h2>Nhận Thông Báo Kiện Gốm Mới</h2>
          <p>
            Một lời nhắn nhỏ khi tiệm có thêm những món gốm đáng yêu. Để lại
            email, chúng mình sẽ ghi nhận mong muốn nhận tin của bạn.
          </p>
          {subscribed ? (
            <div className="about-subscribe-success" role="status">
              <CheckCircle2 size={22} />
              <span>
                Tiệm đã nhận yêu cầu đăng ký của bạn. Cảm ơn bạn đã thương gốm!
              </span>
            </div>
          ) : (
            <form onSubmit={subscribe}>
              <label className="about-sr-only" htmlFor="about-newsletter-email">
                Địa chỉ email nhận tin
              </label>
              <input
                id="about-newsletter-email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={254}
                required
                placeholder="Nhập địa chỉ email của bạn…"
              />
              <button className="about-button" disabled={busy}>
                {busy ? "Đang ghi nhận…" : "Đăng Ký"}
              </button>
            </form>
          )}
          <small>
            Bằng việc đăng ký, bạn đồng ý để tiệm liên hệ qua email về các kiện
            gốm mới.
          </small>
          <Link className="about-policy-link" to="/chinh-sach">
            Chính sách của tiệm
          </Link>
        </div>
      </section>
    </div>
  );
}
