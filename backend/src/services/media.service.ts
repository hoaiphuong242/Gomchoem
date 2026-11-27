import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { ApiError } from "@/lib/errors";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { cloudinaryReady, requiredEnv } from "@/lib/integrations";

const directory = () => path.join(process.cwd(), "var", "uploads");
const types: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};
export async function upload(file: File) {
  if (
    file.size === 0 ||
    file.size > (file.type.startsWith("video/") ? 50 : 15) * 1024 * 1024
  )
    throw new ApiError("Ảnh tối đa 15MB, video tối đa 50MB", 422);
  const data = Buffer.from(await file.arrayBuffer());
  const ext =
    data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
      ? "jpg"
      : data
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        ? "png"
        : data.toString("ascii", 0, 4) === "RIFF" &&
            data.toString("ascii", 8, 12) === "WEBP"
          ? "webp"
          : data.toString("ascii", 4, 8) === "ftyp"
            ? "mp4"
            : data.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
              ? "webm"
              : null;
  if (!ext || types[ext] !== file.type)
    throw new ApiError(
      "Chỉ nhận ảnh JPG, PNG, WebP hoặc video MP4, WebM hợp lệ",
      422,
    );
  if (cloudinaryReady()) {
    const resourceType = ext === "mp4" || ext === "webm" ? "video" : "image";
    try {
      const result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          cloud_name: requiredEnv("CLOUDINARY_CLOUD_NAME"),
          api_key: requiredEnv("CLOUDINARY_API_KEY"),
          api_secret: requiredEnv("CLOUDINARY_API_SECRET"),
          resource_type: resourceType,
          folder: `${process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || "gomchoem"}/${resourceType === "video" ? "videos" : "images"}`,
          public_id: randomUUID(), overwrite: false,
          allowed_formats: resourceType === "video" ? ["mp4", "webm"] : ["jpg", "jpeg", "png", "webp"],
          timeout: 60_000,
        }, (error, uploaded) => error || !uploaded ? reject(error || new Error("Upload failed")) : resolve(uploaded));
        stream.end(data);
      });
      if (!result.secure_url?.startsWith("https://")) throw new Error("Missing secure delivery URL");
      return { url: result.secure_url };
    } catch {
      throw new ApiError("Không tải được lên Cloudinary. Vui lòng thử lại hoặc kiểm tra cấu hình dịch vụ.", 502);
    }
  }
  if (["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"].some(k => process.env[k]?.trim())) throw new ApiError("Cấu hình Cloudinary chưa đầy đủ", 503);
  if (process.env.NODE_ENV === "production") throw new ApiError("Tiệm chưa cấu hình lưu trữ Cloudinary", 503);
  await mkdir(directory(), { recursive: true });
  const filename = `${randomUUID()}.${ext}`;
  await writeFile(path.join(directory(), filename), data, { flag: "wx" });
  return { url: `/api/shop/media/${filename}` };
}
export async function media(filename: string) {
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp|mp4|webm)$/.test(filename))
    throw new ApiError("Không tìm thấy file", 404);
  try {
    return {
      data: await readFile(path.join(directory(), filename)),
      type: types[filename.split(".").pop()!],
    };
  } catch {
    throw new ApiError("Không tìm thấy file", 404);
  }
}
