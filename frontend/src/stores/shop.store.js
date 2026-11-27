import { create } from "zustand";
import { persist } from "zustand/middleware";
import { disablePush } from "@/lib/push";

export const useCart = create(
  persist(
    (set, get) => ({
      items: [],
      add(product, quantity = 1) {
        set({
          items: get().items.some((i) => i.productId === product.id)
            ? get().items.map((i) =>
                i.productId === product.id
                  ? {
                      ...i,
                      quantity: Math.min(
                        product.available,
                        i.quantity + quantity,
                      ),
                    }
                  : i,
              )
            : [
                ...get().items,
                {
                  productId: product.id,
                  name: product.name,
                  slug: product.slug,
                  price: product.price,
                  image: product.images?.[0]?.url,
                  quantity: Math.min(product.available, quantity),
                },
              ],
        });
      },
      quantity(id, quantity) {
        set({
          items: get().items.map((i) =>
            i.productId === id
              ? { ...i, quantity: Math.max(1, Math.min(100, quantity)) }
              : i,
          ),
        });
      },
      remove(id) {
        set({ items: get().items.filter((i) => i.productId !== id) });
      },
      clear() {
        set({ items: [] });
      },
    }),
    { name: "gomchoem-cart-v1" },
  ),
);

let initialUser = null;
try {
  initialUser = JSON.parse(sessionStorage.getItem("gce-user") || "null");
} catch {
  /* Recover invalid browser state. */
}
export const useAuth = create((set) => ({
  user: initialUser,
  login(data) {
    sessionStorage.setItem("gce-token", data.accessToken);
    sessionStorage.setItem("gce-user", JSON.stringify(data.user));
    set({ user: data.user });
  },
  update(user) {
    sessionStorage.setItem("gce-user", JSON.stringify(user));
    set({ user });
  },
  async logout() {
    const accessToken = sessionStorage.getItem("gce-token");
    const cleanup = disablePush(accessToken).catch(() => {});
    sessionStorage.removeItem("gce-token");
    sessionStorage.removeItem("gce-user");
    sessionStorage.removeItem("gce-reservation");
    set({ user: null });
    await cleanup;
  },
}));
