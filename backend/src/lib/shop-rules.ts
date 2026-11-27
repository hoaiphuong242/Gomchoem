export function shippingFee(city: string, pickup: boolean) {
  const normalized = city
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z]/g, "");
  return pickup
    ? 0
    : ["danang", "tpdanang", "thanhphodanang"].includes(normalized)
      ? 20000
      : 35000;
}
export function loyaltyRate(purchasedQuantity: number) {
  return purchasedQuantity >= 20 ? 0.1 : purchasedQuantity >= 10 ? 0.05 : 0;
}
export function canReturn(deliveredAt: Date | null, now = new Date()) {
  return (
    !!deliveredAt &&
    now.getTime() >= deliveredAt.getTime() &&
    now.getTime() - deliveredAt.getTime() <= 48 * 3600_000
  );
}
export const reserveMilliseconds = 180_000;
