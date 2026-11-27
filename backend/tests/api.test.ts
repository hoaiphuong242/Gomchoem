import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { NextRequest } from "next/server";
import {
  createUserSchema,
  updateUserSchema,
  listUsersSchema,
} from "../src/schemas/user.schema";
import { createToken, verifyToken } from "../src/lib/jwt";
import { proxy } from "../src/proxy";
import {
  requireAdmin,
  requireOwnerOrAdmin,
} from "../src/services/auth.service";
import { POST as register } from "../src/app/api/auth/register/route";

process.env.JWT_SECRET = "test-secret-with-at-least-32-bytes-long";
process.env.CORS_ORIGINS = "http://localhost:5173";

test("validation normalizes email and rejects privilege injection and bcrypt truncation", () => {
  const input = {
    name: " Test ",
    email: " TEST@Example.com ",
    password: "password123",
  };
  assert.equal(createUserSchema.parse(input).email, "test@example.com");
  assert.equal(
    createUserSchema.safeParse({ ...input, role: "ADMIN" }).success,
    false,
  );
  assert.equal(
    createUserSchema.safeParse({ ...input, password: "😀".repeat(19) }).success,
    false,
  );
  assert.equal(updateUserSchema.safeParse({}).success, false);
  assert.equal(listUsersSchema.safeParse({ limit: "1000" }).success, false);
});

test("JWT rejects tampering and expired tokens", async () => {
  const token = await createToken("test-user");
  assert.equal(await verifyToken(token), "test-user");
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ sub: "admin" })).toString(
    "base64url",
  );
  await assert.rejects(verifyToken(parts.join(".")));
  const expired = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("test-user")
    .setIssuer("backend")
    .setAudience("backend-api")
    .setIssuedAt()
    .setExpirationTime(1)
    .sign(new TextEncoder().encode(process.env.JWT_SECRET));
  await assert.rejects(verifyToken(expired));
});

test("CORS allows preflight before auth and decorates unauthorized responses", async () => {
  const headers = { origin: "http://localhost:5173" };
  const preflight = await proxy(
    new NextRequest("http://localhost/api/users", {
      method: "OPTIONS",
      headers,
    }),
  );
  assert.equal(preflight.status, 204);
  assert.equal(
    preflight.headers.get("access-control-allow-origin"),
    headers.origin,
  );
  const unauthorized = await proxy(
    new NextRequest("http://localhost/api/users", { headers }),
  );
  assert.equal(unauthorized.status, 401);
  assert.equal(
    unauthorized.headers.get("access-control-allow-origin"),
    headers.origin,
  );
  const forbidden = await proxy(
    new NextRequest("http://localhost/api/health", {
      headers: { origin: "https://untrusted.example" },
    }),
  );
  assert.equal(forbidden.status, 403);
  assert.equal(forbidden.headers.get("access-control-allow-origin"), null);
});

test("authorization rejects other users and requires admin for management", () => {
  const actor = {
    id: "owner",
    name: "Owner",
    email: "owner@example.com",
    role: "USER" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  assert.doesNotThrow(() => requireOwnerOrAdmin(actor, "owner"));
  assert.throws(() => requireOwnerOrAdmin(actor, "someone-else"));
  assert.throws(() => requireAdmin(actor));
  assert.doesNotThrow(() =>
    requireOwnerOrAdmin({ ...actor, role: "ADMIN" }, "someone-else"),
  );
});

test("route rejects malformed JSON and invalid data before reaching DB", async () => {
  const malformed = await register(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: "{",
    }),
  );
  assert.equal(malformed.status, 400);
  const invalid = await register(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ role: "ADMIN" }),
    }),
  );
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).success, false);
});
