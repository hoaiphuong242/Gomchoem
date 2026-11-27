import assert from "node:assert/strict";
import { test } from "node:test";
import { canReturn, shippingFee, loyaltyRate } from "../src/lib/shop-rules";
import { webUrlSchema } from "../src/schemas/shop.schema";

test("uploaded evidence and product links reject executable URL schemes", () => {
  assert.equal(webUrlSchema.safeParse("javascript:alert(1)").success, false);
  assert.equal(webUrlSchema.safeParse("data:text/html,<script>1</script>").success, false);
  assert.equal(webUrlSchema.safeParse("https://example.com/photo.png").success, true);
});

test("shipping prices recognize Da Nang with Vietnamese accents", () => {
  for (const city of ["Đà Nẵng", "Da Nang", "TP. Đà Nẵng", "Thành phố Đà Nẵng"])
    assert.equal(shippingFee(city, false), 20000);
  assert.equal(shippingFee("Huế", false), 35000);
  assert.equal(shippingFee("Hà Nội", true), 0);
});
test("returns use delivery timestamp and include the 48-hour boundary", () => {
  const delivered = new Date("2026-11-21T00:00:00Z");
  assert.equal(canReturn(null), false);
  assert.equal(
    canReturn(delivered, new Date(delivered.getTime() + 48 * 3600000)),
    true,
  );
  assert.equal(
    canReturn(delivered, new Date(delivered.getTime() + 48 * 3600000 + 1)),
    false,
  );
});
test("loyalty thresholds", () => {
  assert.equal(loyaltyRate(9), 0);
  assert.equal(loyaltyRate(10), 0.05);
  assert.equal(loyaltyRate(20), 0.1);
});
