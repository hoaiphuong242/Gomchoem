import { SignJWT, jwtVerify } from "jose";
import { ApiError } from "@/lib/errors";

const issuer = "backend";
const audience = "backend-api";
export const tokenLifetimeSeconds = 60 * 60;

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || new TextEncoder().encode(secret).length < 32) {
    throw new Error("JWT_SECRET must contain at least 32 bytes");
  }
  return new TextEncoder().encode(secret);
}

export async function createToken(userId: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${tokenLifetimeSeconds}s`)
    .sign(getSecret());
}

export async function verifyToken(token: string) {
  const secret = getSecret();
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
      issuer,
      audience,
      requiredClaims: ["sub", "iat", "exp"],
    });
    if (!payload.sub) throw new Error("Missing subject");
    return payload.sub;
  } catch {
    throw new ApiError("Token không hợp lệ hoặc đã hết hạn", 401);
  }
}

export function bearerToken(request: Request) {
  const match = /^Bearer ([^\s]+)$/i.exec(
    request.headers.get("authorization") ?? "",
  );
  if (!match) throw new ApiError("Vui lòng đăng nhập", 401);
  return match[1];
}
