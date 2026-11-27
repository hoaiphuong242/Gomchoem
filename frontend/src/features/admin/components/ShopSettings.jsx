import { useState } from "react";

import { toast } from "sonner";
import { useRemote } from "@/hooks/useRemote";

import { put } from "@/services/api/client";

import { ErrorBox, Loading } from "@/components/common/ShopUI";

export default function ShopSettings() {
  const { data, error } = useRemote("/shop/settings");
  const [busy, setBusy] = useState(false);
  if (error) return <ErrorBox error={error} />;
  if (!data) return <Loading />;
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await put(
        "/shop/admin/settings",
        Object.fromEntries(new FormData(e.currentTarget)),
      );
      toast.success("Đã lưu thông tin cửa hàng");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="panel settings-form" onSubmit={save}>
      <h2>Thông tin chính thức của tiệm</h2>
      <p className="muted">
        Thông tin bên dưới được hiển thị công khai cho khách. Tài khoản ngân
        hàng dùng để khách chuyển khoản, nhân viên vẫn xác nhận thủ công.
      </p>
      <label>
        Địa chỉ cửa hàng
        <input name="address" defaultValue={data.address} maxLength={500} />
      </label>
      <div className="form-grid">
        <label>
          Hotline / Zalo
          <input name="phone" defaultValue={data.phone} maxLength={20} />
        </label>
        <label>
          Giờ mở cửa
          <input
            name="openingHours"
            defaultValue={data.openingHours}
            maxLength={100}
          />
        </label>
      </div>
      <h3>Tài khoản nhận chuyển khoản</h3>
      <label>
        Ngân hàng
        <input name="bankName" defaultValue={data.bankName} maxLength={100} />
      </label>
      <label>
        Số tài khoản
        <input
          name="bankAccount"
          defaultValue={data.bankAccount}
          maxLength={40}
        />
      </label>
      <label>
        Chủ tài khoản
        <input name="bankOwner" defaultValue={data.bankOwner} maxLength={100} />
      </label>
      <button className="btn" disabled={busy}>
        Lưu thông tin tiệm
      </button>
    </form>
  );
}
