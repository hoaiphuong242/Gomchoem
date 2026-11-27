import { Link, useSearchParams } from "react-router-dom";

import { ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { useRemote } from "@/hooks/useRemote";

import {
  Benefits,
  Empty,
  ErrorBox,
  Loading,
  ProductCard,
} from "@/components/common/ShopUI";

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const { data, error } = useRemote(`/shop/products?${params.toString()}`);
  const categories = useRemote("/shop/categories").data || [];
  function change(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.delete("page");
    setParams(next);
  }
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link to="/">Trang chủ</Link>
        <ChevronRight size={13} /> Kệ gốm
      </div>
      <div className="catalog-intro">
      <div className="catalog-heading">
        <div className="eyebrow">SLOW DAYS & VINTAGE POTTERY</div>
        <h1>
          Mỗi món gốm,
          <br />
          <em>một duyên lành.</em>
        </h1>
        <p>
          Tìm món vừa vặn với bạn. Màu men thật, tình trạng thật, câu chuyện
          thật.
        </p>
      </div>
      <section className="catalog-film" aria-label="Video giới thiệu gốm Gốm Cho Em">
        <div className="catalog-film-frame">
          <video autoPlay muted loop playsInline controls preload="metadata" poster="/videos/gomchoem-pottery-poster.jpg" aria-label="Những món gốm tại Gốm Cho Em">
            <source src="/videos/gomchoem-pottery.mp4" type="video/mp4" />
          </video>
        </div>
      </section>
      </div>
      <div className="catalog-controls">
        <div className="tabs">
          <button
            className={!params.get("category") ? "active" : ""}
            onClick={() => change("category", "")}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              className={params.get("category") === c.slug ? "active" : ""}
              key={c.id}
              onClick={() => change("category", c.slug)}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div className="filter-row">
          <form
            className="catalog-search"
            onSubmit={(e) => {
              e.preventDefault();
              change("q", new FormData(e.currentTarget).get("q"));
            }}
          >
            <Search size={17} />
            <input
              name="q"
              placeholder="Tên món gốm hoặc mã sản phẩm"
              defaultValue={params.get("q") || ""}
            />
            <button className="text-link">Tìm</button>
          </form>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={params.get("unique") === "true"}
              onChange={(e) => change("unique", e.target.checked ? "true" : "")}
            />{" "}
            Chỉ còn 1 chiếc
          </label>
          <label className="sort">
            <SlidersHorizontal size={16} />
            <select
              aria-label="Sắp xếp sản phẩm"
              value={params.get("sort") || ""}
              onChange={(e) => change("sort", e.target.value)}
            >
              <option value="">Mới lên kệ</option>
              <option value="price-asc">Giá tăng dần</option>
              <option value="price-desc">Giá giảm dần</option>
            </select>
          </label>
        </div>
      </div>
      <p className="muted">
        {data
          ? `${data.total} món gốm đang mở bán`
          : "Đang tìm những món có duyên…"}
      </p>
      {error ? (
        <ErrorBox error={error} />
      ) : !data ? (
        <Loading />
      ) : data.items.length ? (
        <>
          <div className="product-grid">
            {data.items.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
          <div className="pagination">
            {Array.from({ length: data.pages }, (_, i) => (
              <button
                className={data.page === i + 1 ? "active" : ""}
                key={i}
                onClick={() => change("page", String(i + 1))}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </>
      ) : (
        <Empty
          title="Chưa tìm thấy món phù hợp"
          text="Thử một từ khóa hoặc danh mục khác nhé."
        />
      )}
      <Benefits />
    </div>
  );
}
