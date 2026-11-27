import { create } from "zustand";
import { get, post } from "@/services/api/client";
import { useAuth } from "@/stores/shop.store";

export const useNotifications = create((set, getState) => ({
  data: null, error: "",
  reset() { set({ data: null, error: "" }); },
  async refresh() {
    const userId = useAuth.getState().user?.id;
    if (!userId) return;
    try { const data = await get("/shop/notifications"); if (useAuth.getState().user?.id === userId) set({ data, error: "" }); }
    catch (error) { if (useAuth.getState().user?.id === userId) set({ error: error.message }); }
  },
  async read(id) { await post("/shop/notifications/read", id ? { id } : {}); await getState().refresh(); },
}));
