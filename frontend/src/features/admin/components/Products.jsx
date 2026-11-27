import { useState } from "react";

import { Plus, Search, Upload } from "lucide-react";
import { toast } from "sonner";

import { post, put, upload } from "@/services/api/client";
import { money } from "@/lib/format";

import Modal from "./Modal";
export default function Products({ data, categories, refresh, user }) {
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [imageUrls, setImageUrls] = useState("");
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const body = {
        name: f.get("name"),
        sku: f.get("sku"),
        slug: f.get("slug"),
        categoryId: f.get("categoryId"),
        price: Number(f.get("price")),
        costPrice: Number(f.get("costPrice")),
        description: f.get("description"),
        conditionDetail: f.get("conditionDetail"),
        origin: f.get("origin"),
        dimensions: f.get("dimensions"),
        material: f.get("material"),
        active: f.get("active") === "on",
        featured: f.get("featured") === "on",
        images: imageUrls
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };
      if (editing.id) await put(`/shop/admin/products/${editing.id}`, body);
      else await post("/shop/admin/products", body);
      setEditing(null);
      refresh();
      toast.success(
        "Đã lưu sản phẩm. Nhập tồn kho tại mục Tồn kho & nhập hàng.",
      );
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function uploadImages(e) {
    setBusy(true);
    try {
      const urls = [];
      for (const file of e.target.files) urls.push((await upload(file)).url);
      setImageUrls((v) => [v, ...urls].filter(Boolean).join("\n"));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="admin-filters">
        <div className="catalog-search">
          <Search size={16} />
          <input
            placeholder="Tên hoặc mã sản phẩm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {user.role === "ADMIN" && (
          <button
            className="btn"
            onClick={() => {
              setEditing({});
              setImageUrls("");
            }}
          >
            <Plus size={17} />
            Thêm sản phẩm
          </button>
        )}
      </div>
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Sản phẩm</th>
                <th>Danh mục</th>
                <th>Giá bán</th>
                <th>Có thể bán</th>
                <th>Hiển thị</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.inventory
                .filter((p) =>
                  `${p.name} ${p.sku}`
                    .toLowerCase()
                    .includes(query.toLowerCase()),
                )
                .map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="table-product">
                        <img src={p.images[0]?.url} alt="" />
                        <div>
                          <strong>{p.name}</strong>
                          <small>{p.sku}</small>
                        </div>
                      </div>
                    </td>
                    <td>{p.category.name}</td>
                    <td>{money(p.price)}</td>
                    <td>{p.available}</td>
                    <td>{p.active ? "Đang mở bán" : "Ẩn"}</td>
                    <td>
                      {user.role === "ADMIN" && (
                        <button
                          className="text-link"
                          onClick={() => {
                            setEditing(p);
                            setImageUrls(p.images.map((i) => i.url).join("\n"));
                          }}
                        >
                          Chỉnh sửa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {editing && (
        <Modal
          title={editing.id ? "Chỉnh sửa món gốm" : "Thêm món gốm mới"}
          close={() => setEditing(null)}
        >
          <form onSubmit={save}>
            <div className="form-grid">
              <label>
                Tên sản phẩm
                <input
                  name="name"
                  required
                  defaultValue={editing.name}
                  maxLength={200}
                />
              </label>
              <label>
                Mã SKU
                <input
                  name="sku"
                  required
                  defaultValue={editing.sku}
                  maxLength={50}
                />
              </label>
              <label>
                Slug (không dấu, gạch ngang)
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  defaultValue={editing.slug}
                />
              </label>
              <label>
                Danh mục
                <select
                  name="categoryId"
                  defaultValue={editing.categoryId}
                  required
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Giá bán / chiếc
                <input
                  name="price"
                  type="number"
                  min="0"
                  max="100000000"
                  required
                  defaultValue={editing.price}
                />
              </label>
              <label>
                Giá vốn / chiếc
                <input
                  name="costPrice"
                  type="number"
                  min="0"
                  defaultValue={editing.costPrice || 0}
                />
              </label>
              <label>
                Xuất xứ
                <input
                  name="origin"
                  required
                  defaultValue={editing.origin || "Nhật Bản"}
                />
              </label>
              <label>
                Chất liệu
                <input
                  name="material"
                  required
                  defaultValue={editing.material || "Gốm sứ"}
                />
              </label>
            </div>
            <label>
              Kích thước / dung tích
              <input name="dimensions" defaultValue={editing.dimensions} />
            </label>
            <label>
              Mô tả
              <textarea
                name="description"
                required
                defaultValue={editing.description}
                maxLength={10000}
              />
            </label>
            <label>
              Tình trạng secondhand / khuyết điểm
              <textarea
                name="conditionDetail"
                defaultValue={editing.conditionDetail}
                maxLength={2000}
              />
            </label>
            <label>
              Ảnh (mỗi dòng một URL, ảnh đầu làm ảnh chính)
              <textarea
                required
                value={imageUrls}
                onChange={(e) => setImageUrls(e.target.value)}
                rows={4}
              />
            </label>
            <label className="file-upload">
              <Upload size={17} />
              Tải ảnh sản phẩm
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={uploadImages}
              />
            </label>
            <div className="form-grid">
              <label className="check-inline">
                <input
                  name="active"
                  type="checkbox"
                  defaultChecked={editing.active ?? true}
                />
                Mở bán trên website
              </label>
              <label className="check-inline">
                <input
                  name="featured"
                  type="checkbox"
                  defaultChecked={editing.featured}
                />
                Sản phẩm nổi bật
              </label>
            </div>
            <p className="muted">
              Mẫu mới có tồn kho bằng 0. Nhập số lượng thực tế ở mục Tồn kho
              trước khi bán.
            </p>
            <button className="btn" disabled={busy}>
              {busy ? "Đang lưu…" : "Lưu sản phẩm"}
            </button>
          </form>
        </Modal>
      )}
    </>
  );
}
