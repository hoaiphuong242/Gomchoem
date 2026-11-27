import { confirmAction } from "@/lib/confirm";
import { useState } from "react";

import { toast } from "sonner";

import { put } from "@/services/api/client";
import { roles } from "@/lib/format";

export default function Staff({ data, refresh, user }) {
  const [busy, setBusy] = useState(false);
  async function change(id, role) {
    if (!(await confirmAction(`Đổi quyền tài khoản thành ${roles[role]}?`)))
      return;
    setBusy(true);
    try {
      await put(`/shop/admin/users/${id}`, { role });
      refresh();
      toast.success("Đã cập nhật quyền");
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>Tài khoản & phân quyền</h2>
      <p className="muted">
        Nhân viên đăng ký tài khoản trước; chủ tiệm cấp đúng vai trò ở đây.
        Quyền được kiểm tra lại từ database ở mỗi request.
      </p>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Họ tên</th>
              <th>Email</th>
              <th>Vai trò</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    aria-label={`Vai trò ${u.name}`}
                    value={u.role}
                    disabled={busy || u.id === user.id}
                    onChange={(e) => change(u.id, e.target.value)}
                  >
                    {Object.entries(roles).map(([key, title]) => (
                      <option key={key} value={key}>
                        {title}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
