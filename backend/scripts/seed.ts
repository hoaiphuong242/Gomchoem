import "./load-env";
import { getPrisma } from "../src/lib/prisma";

// Sample catalog only; never resets stock or edits existing products/accounts.
async function main() {
  const categories = [
    ["Chén & Tô", "chen-to"],
    ["Đĩa gốm", "dia-gom"],
    ["Muỗng & Thìa", "muong-thia"],
    ["Ly & Tách", "ly-tach"],
    ["Bình hoa", "binh-hoa"],
  ];
  const ids: string[] = [];
  for (const [name, slug] of categories) {
    const c = await getPrisma().category.upsert({
      where: { slug },
      create: { name, slug },
      update: {},
    });
    ids.push(c.id);
  }
  const catalog = [
    [
      "Bát hoa cúc men kem",
      "bat-hoa-cuc-men-kem",
      165000,
      0,
      1,
      "photo-1493106641515-6b5631de4bb9",
    ],
    [
      "Ly mộc cho ngày thảnh thơi",
      "ly-moc-ngay-thanh-thoi",
      145000,
      3,
      1,
      "photo-1514228742587-6b1558fcca3d",
    ],
    [
      "Đĩa men lam hoa nhỏ",
      "dia-men-lam-hoa-nho",
      185000,
      1,
      1,
      "photo-1578749556568-bc2c40e68b61",
    ],
    [
      "Cốc gốm nông trại",
      "coc-gom-nong-trai",
      70000,
      3,
      2,
      "photo-1577937927133-66ef06acdf18",
    ],
    [
      "Thìa gốm mật ong",
      "thia-gom-mat-ong",
      35000,
      2,
      5,
      "photo-1493106641515-6b5631de4bb9",
    ],
    [
      "Bình hoa dáng mộc",
      "binh-hoa-dang-moc",
      245000,
      4,
      1,
      "photo-1578500494198-246f612d3b3d",
    ],
    [
      "Tách trà men rạn",
      "tach-tra-men-ran",
      120000,
      3,
      1,
      "photo-1514228742587-6b1558fcca3d",
    ],
    [
      "Đĩa sâu lòng màu đất",
      "dia-sau-long-mau-dat",
      175000,
      1,
      0,
      "photo-1578749556568-bc2c40e68b61",
    ],
  ];
  for (let i = 0; i < catalog.length; i++) {
    const [name, slug, price, category, stock, image] = catalog[i] as [
      string,
      string,
      number,
      number,
      number,
      string,
    ];
    await getPrisma().product.upsert({
      where: { slug },
      update: {},
      create: {
        name,
        slug,
        sku: `GCE-DEMO-${String(i + 1).padStart(3, "0")}`,
        categoryId: ids[category],
        price,
        costPrice: Math.round(price * 0.5),
        description:
          "Một món gốm secondhand được tuyển chọn, mang sắc men trầm ấm và nét mộc riêng. Ảnh minh họa mẫu; tiệm sẽ cập nhật ảnh thật trước khi mở bán chính thức.",
        conditionDetail:
          "Hàng secondhand. Vui lòng xem kỹ ảnh và liên hệ tiệm để được quay cận cảnh tình trạng thực tế.",
        dimensions: "Đang cập nhật",
        featured: i < 4,
        inventory: { create: { onHand: stock } },
        images: {
          create: [
            {
              url: `https://images.unsplash.com/${image}?auto=format&fit=crop&w=1000&q=85`,
              position: 0,
            },
          ],
        },
      },
    });
  }
  await getPrisma().voucher.upsert({
    where: { code: "CHAOEM" },
    update: {},
    create: { code: "CHAOEM", amount: 20000, minTotal: 200000, maxUses: 100 },
  });
  console.log(
    "Đã thêm danh mục và sản phẩm mẫu (không ghi đè tồn kho hiện có).",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => getPrisma().$disconnect());
