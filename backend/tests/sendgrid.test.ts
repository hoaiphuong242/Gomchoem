import assert from "node:assert/strict";
import { test } from "node:test";
import { sendgridError } from "../src/lib/sendgrid";

test("SendGrid sender identity failure is actionable and doesn't expose provider addresses", async () => {
  const error = await sendgridError(Response.json({ errors: [{ message: "The from address private@example.com does not match a verified Sender Identity." }] }, { status: 403 }));
  assert.equal(error.permanent, true);
  assert.match(error.message, /SENDGRID_FROM_EMAIL/);
  assert.ok(!error.message.includes("private@example.com"));
});
test("SendGrid temporary errors retry, authentication errors require configuration repair", async () => {
  for (const status of [408, 429, 500, 503]) assert.equal((await sendgridError(new Response("not json", { status }))).permanent, false);
  for (const status of [400, 401, 403, 404]) assert.equal((await sendgridError(new Response("", { status }))).permanent, true);
});
