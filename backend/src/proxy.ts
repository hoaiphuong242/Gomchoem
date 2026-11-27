import { NextResponse, type NextRequest } from "next/server";
import { bearerToken, verifyToken } from "@/lib/jwt";
import { apiError, handleApiError } from "@/lib/response";

const publicPaths = new Set(["/api/health", "/api/auth/login", "/api/auth/register"]);

export async function proxy(request: NextRequest) {
  const origin = request.headers.get("origin");
  const allowedOrigins = (process.env.CORS_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  const allowed = origin !== null && allowedOrigins.includes(origin);
  let response: NextResponse;

  if (origin && !allowed) {
    response = apiError("Origin không được phép", 403);
  } else if (request.method === "OPTIONS") {
    response = new NextResponse(null, { status: 204 });
  } else {
    try {
      // Shop routes perform authorization in services; catalogue/contact/media are public.
      if (!publicPaths.has(request.nextUrl.pathname) && !request.nextUrl.pathname.startsWith("/api/shop/")) await verifyToken(bearerToken(request));
      response = NextResponse.next();
    } catch (error) { response = handleApiError(error); }
  }

  response.headers.set("Vary", "Origin");
  if (allowed && origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.headers.set("Access-Control-Max-Age", "600");
  }
  return response;
}

export const config = { matcher: "/api/:path*" };
