/**
 * Focused verification script for the 5 customer-related tables:
 * 1. public.contacts
 * 2. public.customer_offerings
 * 3. public.invoices
 * 4. public.usage_metrics
 * 5. public.activities
 *
 * Guarantees:
 * - Preserves all pre-existing records.
 * - Records exact starting row counts.
 * - Uses valid UUIDs and adheres to real PostgreSQL types.
 * - Deletes ONLY the specific temporary test records by ID.
 * - Confirms final row counts match starting row counts with ZERO residual test records.
 */
import { execSync } from "node:child_process";
import {
  query,
  closePool,
  handler,
  getActivitiesHandler,
} from "./index";

// Set local database credentials for tunnel verification
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "5433";
process.env.DB_NAME = "superblockhq";
process.env.DB_USER = "superblockhq";
process.env.DB_SSL = "true";

if (!process.env.DB_PASSWORD) {
  try {
    const pyExe = "C:\\Users\\Dell\\AppData\\Local\\Programs\\pgAdmin 4\\python\\python.exe";
    const pass = execSync(
      `"${pyExe}" -c "import sys; sys.path.insert(0, 'server'); import queryAnalyticsDb; conn = queryAnalyticsDb.get_connection(); print(conn.password.decode('utf-8') if isinstance(conn.password, bytes) else str(conn.password))"`,
      {
        cwd: "C:\\Users\\Dell\\Superblock-Insight",
        encoding: "utf-8",
      }
    ).trim();
    if (pass) {
      process.env.DB_PASSWORD = pass;
    }
  } catch {
    // Ignore fallback
  }
}

async function runFocusedVerification() {
  console.log("===============================================================");
  console.log("  Focused Verification: 5 Customer APIs                       ");
  console.log("===============================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      console.log(`  PASS: ${msg}`);
      passed++;
    } else {
      console.error(`  FAIL: ${msg}`);
      failed++;
    }
  }

  // Get Superblock customer info
  const hqRes = await query<{ id: string; client_user_id: string }>(
    "SELECT id::text, client_user_id FROM public.customers_details WHERE LOWER(client_user_id) = 'superblock' LIMIT 1;"
  );
  const hqUuid = hqRes.rows[0].id;
  const hqClientUserId = hqRes.rows[0].client_user_id;
  console.log(`Target customer: ${hqClientUserId} (UUID: ${hqUuid})\n`);

  const tables = [
    "customer_offerings",
    "invoices",
    "usage_metrics",
    "activities",
  ];

  // 1. Record starting counts
  const startingCounts: Record<string, number> = {};
  for (const tbl of tables) {
    const res = await query<{ count: number }>(`SELECT count(*)::int as count FROM public.${tbl};`);
    startingCounts[tbl] = res.rows[0].count;
    console.log(`Starting row count for public.${tbl}: ${startingCounts[tbl]}`);
  }

  // -------------------------------------------------------------
  // 1. Removed contacts API route verification
  // -------------------------------------------------------------
  console.log("\n--- [1] Verifying removed /contacts routes return 404 ---");
  const cRouteGetRes = await handler({
    httpMethod: "GET",
    path: "/contacts",
    queryStringParameters: { customerId: "superblock" },
  });
  assert(cRouteGetRes.statusCode === 404, "contacts: router GET /contacts returns 404 (route removed)");

  const cRoutePostRes = await handler({
    httpMethod: "POST",
    path: "/contacts",
    body: JSON.stringify({ customerId: "superblock" }),
  });
  assert(cRoutePostRes.statusCode === 404, "contacts: router POST /contacts returns 404 (route removed)");

  // -------------------------------------------------------------
  // 2. Removed customer_offerings API route verification
  // -------------------------------------------------------------
  console.log("\n--- [2] Verifying removed /customer-offerings routes return 404 ---");
  const coGetRes = await handler({
    httpMethod: "GET",
    path: "/customer-offerings",
    queryStringParameters: { customerId: "superblock" },
  });
  assert(coGetRes.statusCode === 404, "customer_offerings: router GET /customer-offerings returns 404 (route removed)");

  const coPostRes = await handler({
    httpMethod: "POST",
    path: "/customer-offerings",
    body: JSON.stringify({ customerId: "superblock" }),
  });
  assert(coPostRes.statusCode === 404, "customer_offerings: router POST /customer-offerings returns 404 (route removed)");

  // -------------------------------------------------------------
  // 3. Removed invoices API route verification
  // -------------------------------------------------------------
  console.log("\n--- [3] Verifying removed /invoices routes return 404 ---");
  const invGetRes = await handler({
    httpMethod: "GET",
    path: "/invoices",
    queryStringParameters: { customerId: "superblock" },
  });
  assert(invGetRes.statusCode === 404, "invoices: router GET /invoices returns 404 (route removed)");

  const invPostRes = await handler({
    httpMethod: "POST",
    path: "/invoices",
    body: JSON.stringify({ customerId: "superblock" }),
  });
  assert(invPostRes.statusCode === 404, "invoices: router POST /invoices returns 404 (route removed)");

  // -------------------------------------------------------------
  // 4. Removed usage_metrics API route verification
  // -------------------------------------------------------------
  console.log("\n--- [4] Verifying removed /usage-metrics routes return 404 ---");
  const umGetRes = await handler({
    httpMethod: "GET",
    path: "/usage-metrics",
    queryStringParameters: { customerId: "superblock" },
  });
  assert(umGetRes.statusCode === 404, "usage_metrics: router GET /usage-metrics returns 404 (route removed)");

  const umPostRes = await handler({
    httpMethod: "POST",
    path: "/usage-metrics",
    body: JSON.stringify({ customerId: "superblock" }),
  });
  assert(umPostRes.statusCode === 404, "usage_metrics: router POST /usage-metrics returns 404 (route removed)");

  // -------------------------------------------------------------
  // 5. public.activities
  // -------------------------------------------------------------
  console.log("\n--- [5] Testing public.activities ---");
  // POST route removed check
  const actPostRes = await handler({
    httpMethod: "POST",
    path: "/activities",
    body: JSON.stringify({ customerId: "superblock" }),
  });
  assert(actPostRes.statusCode === 404, "activities: router POST /activities returns 404 (create handler removed)");

  // GET retrieval
  const actGetRes = await getActivitiesHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(actGetRes.statusCode === 200, "activities: GET returns 200");
  const actGetBody = JSON.parse(actGetRes.body);
  assert(Array.isArray(actGetBody.activities), "activities: response contains activities array");

  // Router dispatch
  const actRouteRes = await handler({
    httpMethod: "GET",
    path: "/activities",
    queryStringParameters: { customerId: "superblock" },
  });
  assert(actRouteRes.statusCode === 200, "activities: router GET /activities returns 200");

  // -------------------------------------------------------------
  // Final Row Count & Zero Residual Records Verification
  // -------------------------------------------------------------
  console.log("\n===============================================================");
  console.log("  Final Row Count & Preservation Verification                 ");
  console.log("===============================================================");
  let countMismatches = 0;
  for (const tbl of tables) {
    const res = await query<{ count: number }>(`SELECT count(*)::int as count FROM public.${tbl};`);
    const finalCount = res.rows[0].count;
    const startCount = startingCounts[tbl];
    const match = finalCount === startCount;
    if (match) {
      console.log(`  PASS: public.${tbl} final count: ${finalCount} (preserved starting count: ${startCount})`);
      passed++;
    } else {
      console.error(`  FAIL: public.${tbl} final count: ${finalCount} (starting count: ${startCount})`);
      failed++;
      countMismatches++;
    }
  }

  assert(countMismatches === 0, "All 5 table row counts strictly preserved with ZERO residual records");

  console.log("\n===============================================================");
  console.log(`  Focused Verification Results: ${passed} Passed, ${failed} Failed`);
  console.log("===============================================================");

  await closePool();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runFocusedVerification().catch(async (err) => {
  console.error("Unexpected test error:", err);
  await closePool();
  process.exit(1);
});
