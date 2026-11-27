import { getPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/errors";
export function categories() {
  return getPrisma().category.findMany({ orderBy: { name: "asc" } });
}
export async function resolveProductId(slug: string) {
  const product = await getPrisma().product.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!product) throw new ApiError("Không tìm thấy sản phẩm", 404);
  return product.id;
}
