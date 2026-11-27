import "./load-env";
import { Client } from "pg";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";

async function command(args: string[], databaseUrl: string) {
  const executable = process.platform === "win32" ? "cmd.exe" : "npx";
  const argv =
    process.platform === "win32" ? ["/d", "/s", "/c", "npx", ...args] : args;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, argv, {
      stdio: "inherit",
      windowsHide: true,
      env: { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: "test" },
    });
    child.on("error", reject);
    child.on("exit", (exit) =>
      exit === 0 ? resolve() : reject(new Error(`Check exited ${exit}`)),
    );
  });
}
async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const database = `gce_test_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const adminUrl = new URL(process.env.DATABASE_URL);
  adminUrl.pathname = "/postgres";
  const testUrl = new URL(process.env.DATABASE_URL);
  testUrl.pathname = `/${database}`;
  const admin = new Client({ connectionString: adminUrl.toString() });
  await admin.connect();
  await admin.query(`CREATE DATABASE "${database}"`);
  console.log("Created isolated temporary test database.");
  try {
    // Exercise the exact startup bootstrap on an empty database, then repeat it.
    // NODE_ENV=test prevents creating local admin credentials in the real .env.local.
    await command(["tsx", "scripts/bootstrap.ts"], testUrl.toString());
    const fixtureDb = new Client({ connectionString: testUrl.toString() });
    await fixtureDb.connect();
    try {
      const before = await fixtureDb.query('SELECT count(*)::int AS count FROM "Product"');
      await fixtureDb.query('UPDATE "Inventory" SET "onHand" = 7 WHERE "productId" = (SELECT "id" FROM "Product" WHERE "sku" = $1)', ['GCE-DEMO-001']);
      await command(["tsx", "scripts/bootstrap.ts"], testUrl.toString());
      const after = await fixtureDb.query('SELECT count(*)::int AS count FROM "Product"');
      const stock = await fixtureDb.query('SELECT "onHand" FROM "Inventory" WHERE "productId" = (SELECT "id" FROM "Product" WHERE "sku" = $1)', ['GCE-DEMO-001']);
      if (before.rows[0].count !== 8 || after.rows[0].count !== 8 || stock.rows[0].onHand !== 7) throw new Error('Startup bootstrap changed existing data');
      console.log('Startup bootstrap: empty PostgreSQL initialized; repeat kept catalog count and existing inventory.');
    } finally { await fixtureDb.end(); }
    await command(
      ["tsx", "--test", "--test-concurrency=1", "tests/integration/shop.test.ts", "tests/integration/integrations.test.ts", "tests/integration/notifications.test.ts"],
      testUrl.toString(),
    );
  } finally {
    await admin.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [database],
    );
    await admin.query(`DROP DATABASE "${database}"`);
    await admin.end();
    console.log("Removed temporary test database.");
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
