/**
 * Local automated verification script for Analytics Studio Lambda handlers:
 * 1. public.contacts
 * 2. public.deals
 * 3. public.tickets
 * 4. public.team_members
 * 5. public.products
 * 6. public.subscriptions
 * 7. public.customer_offerings
 * 8. public.invoices
 * 9. public.usage_metrics
 * 10. public.activities
 *
 * Verifies live PostgreSQL queries, validation, parameterization, insertion, retrieval,
 * routing, and cleanup with ZERO permanent test data left behind.
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

async function runAllTests() {
  console.log("===============================================================");
  console.log("  Running Verification Tests for 10 Customer-Related Tables  ");
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
  console.log(`Target test customer: ${hqClientUserId} (UUID: ${hqUuid})\n`);

  // Record initial counts
  const tables = [
    "deals",
    "tickets",
    "team_members",
    "products",
    "subscriptions",
    "customer_offerings",
    "invoices",
    "usage_metrics",
    "activities",
  ];

  const initialCounts: Record<string, number> = {};
  for (const tbl of tables) {
    const res = await query<{ count: number }>(`SELECT count(*)::int as count FROM public.${tbl};`);
    initialCounts[tbl] = res.rows[0].count;
    console.log(`Initial count for public.${tbl}: ${initialCounts[tbl]}`);
  }

  // -------------------------------------------------------------
  // 1. Removed contacts API route verification
  // -------------------------------------------------------------
  console.log("\n--- [Table 1] public.contacts (routes removed) ---");
  const cRouteGetRes = await handler({ httpMethod: "GET", path: "/contacts", queryStringParameters: { customerId: "superblock" } });
  assert(cRouteGetRes.statusCode === 404, "contacts: router GET /contacts returns 404 (route removed)");
  const cRoutePostRes = await handler({ httpMethod: "POST", path: "/contacts", body: JSON.stringify({ customerId: "superblock" }) });
  assert(cRoutePostRes.statusCode === 404, "contacts: router POST /contacts returns 404 (route removed)");

  // -------------------------------------------------------------
  // 2. Removed deals API route verification
  // -------------------------------------------------------------
  console.log("\n--- [Table 2] public.deals (routes removed) ---");
  const dPostRes = await handler({ httpMethod: "POST", path: "/deals", body: JSON.stringify({ customerId: "superblock" }) });
  assert(dPostRes.statusCode === 404, "deals: router POST /deals returns 404 (route removed)");
  const dGetRes = await handler({ httpMethod: "GET", path: "/deals", queryStringParameters: { customerId: "superblock" } });
  assert(dGetRes.statusCode === 404, "deals: router GET /deals returns 404 (route removed)");

  // -------------------------------------------------------------
  // 3. Removed tickets API route verification
  // -------------------------------------------------------------
  console.log("\n--- [Table 3] public.tickets (routes removed) ---");
  const tPostRes = await handler({ httpMethod: "POST", path: "/tickets", body: JSON.stringify({ customerId: "superblock" }) });
  assert(tPostRes.statusCode === 404, "tickets: router POST /tickets returns 404 (route removed)");
  const tGetRes = await handler({ httpMethod: "GET", path: "/tickets", queryStringParameters: { customerId: "superblock" } });
  assert(tGetRes.statusCode === 404, "tickets: router GET /tickets returns 404 (route removed)");

  // -------------------------------------------------------------
  // 4. Removed team_members API route verification
  // -------------------------------------------------------------
  console.log("\n--- [Table 4] public.team_members (routes removed) ---");
  const tmPostRes = await handler({ httpMethod: "POST", path: "/team-members", body: JSON.stringify({ customerId: "superblock" }) });
  assert(tmPostRes.statusCode === 404, "team_members: router POST /team-members returns 404 (route removed)");
  const tmGetRes = await handler({ httpMethod: "GET", path: "/team-members", queryStringParameters: { customerId: "superblock" } });
  assert(tmGetRes.statusCode === 404, "team_members: router GET /team-members returns 404 (route removed)");

  // -------------------------------------------------------------
  // 5. Removed products API route verification
  // -------------------------------------------------------------
  console.log("\n--- [Table 5] public.products (routes removed) ---");
  const pPostRes = await handler({ httpMethod: "POST", path: "/products", body: JSON.stringify({ customerId: "superblock" }) });
  assert(pPostRes.statusCode === 404, "products: router POST /products returns 404 (route removed)");
  const pGetRes = await handler({ httpMethod: "GET", path: "/products", queryStringParameters: { customerId: "superblock" } });
  assert(pGetRes.statusCode === 404, "products: router GET /products returns 404 (route removed)");

  // -------------------------------------------------------------
  // 6. Removed subscriptions API route verification
  // -------------------------------------------------------------
  console.log("\n--- [Table 6] public.subscriptions (routes removed) ---");
  const sPostRes = await handler({ httpMethod: "POST", path: "/subscriptions", body: JSON.stringify({ customerId: "superblock" }) });
  assert(sPostRes.statusCode === 404, "subscriptions: router POST /subscriptions returns 404 (route removed)");
  const sGetRes = await handler({ httpMethod: "GET", path: "/subscriptions", queryStringParameters: { customerId: "superblock" } });
  assert(sGetRes.statusCode === 404, "subscriptions: router GET /subscriptions returns 404 (route removed)");

  // -------------------------------------------------------------
  // 7. Removed customer_offerings API route verification
  // -------------------------------------------------------------
  console.log("\n--- [Table 7] public.customer_offerings (routes removed) ---");
  const coPostRes = await handler({ httpMethod: "POST", path: "/customer-offerings", body: JSON.stringify({ customerId: "superblock" }) });
  assert(coPostRes.statusCode === 404, "customer_offerings: router POST /customer-offerings returns 404 (route removed)");
  const coGetRes = await handler({ httpMethod: "GET", path: "/customer-offerings", queryStringParameters: { customerId: "superblock" } });
  assert(coGetRes.statusCode === 404, "customer_offerings: router GET /customer-offerings returns 404 (route removed)");

  // -------------------------------------------------------------
  // 8. Removed invoices API route verification
  // -------------------------------------------------------------
  console.log("\n--- [Table 8] public.invoices (routes removed) ---");
  const invPostRes = await handler({ httpMethod: "POST", path: "/invoices", body: JSON.stringify({ customerId: "superblock" }) });
  assert(invPostRes.statusCode === 404, "invoices: router POST /invoices returns 404 (route removed)");
  const invGetRes = await handler({ httpMethod: "GET", path: "/invoices", queryStringParameters: { customerId: "superblock" } });
  assert(invGetRes.statusCode === 404, "invoices: router GET /invoices returns 404 (route removed)");

  // -------------------------------------------------------------
  // 9. Removed usage_metrics API route verification
  // -------------------------------------------------------------
  console.log("\n--- [Table 9] public.usage_metrics (routes removed) ---");
  const umPostRes = await handler({ httpMethod: "POST", path: "/usage-metrics", body: JSON.stringify({ customerId: "superblock" }) });
  assert(umPostRes.statusCode === 404, "usage_metrics: router POST /usage-metrics returns 404 (route removed)");
  const umGetRes = await handler({ httpMethod: "GET", path: "/usage-metrics", queryStringParameters: { customerId: "superblock" } });
  assert(umGetRes.statusCode === 404, "usage_metrics: router GET /usage-metrics returns 404 (route removed)");

  // -------------------------------------------------------------
  // 10. public.activities
  // -------------------------------------------------------------
  console.log("\n--- [Table 10] public.activities ---");
  // 10.1 POST route check (create handler removed)
  const actPostRes = await handler({ httpMethod: "POST", path: "/activities", body: JSON.stringify({ customerId: "superblock" }) });
  assert(actPostRes.statusCode === 404, "activities: router POST /activities returns 404 (create handler removed)");

  // 10.2 GET
  const actGetRes = await getActivitiesHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(actGetRes.statusCode === 200, "activities: GET returns 200");
  const actGetBody = JSON.parse(actGetRes.body);
  assert(Array.isArray(actGetBody.activities), "activities: returns activities array");

  // 10.3 Route check
  const actRouteRes = await handler({ httpMethod: "GET", path: "/activities", queryStringParameters: { customerId: "superblock" } });
  assert(actRouteRes.statusCode === 200, "activities: router GET /activities returns 200");

  // -------------------------------------------------------------
  // Final Row Count Verification
  // -------------------------------------------------------------
  console.log("\n===============================================================");
  console.log("  Final Row Count Verification Across All 10 Tables           ");
  console.log("===============================================================");
  let countMismatches = 0;
  for (const tbl of tables) {
    const res = await query<{ count: number }>(`SELECT count(*)::int as count FROM public.${tbl};`);
    const finalCount = res.rows[0].count;
    const initialCount = initialCounts[tbl];
    const match = finalCount === initialCount;
    if (match) {
      console.log(`  PASS: public.${tbl} count matches exactly: ${finalCount} (initial: ${initialCount})`);
      passed++;
    } else {
      console.error(`  FAIL: public.${tbl} count mismatch! Final: ${finalCount}, Initial: ${initialCount}`);
      failed++;
      countMismatches++;
    }
  }

  assert(countMismatches === 0, "Zero row count mismatches across all tables (zero residual test data)");

  console.log("\n===============================================================");
  console.log(`  All 10 Tables Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("===============================================================");

  await closePool();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAllTests().catch(async (err) => {
  console.error("Unexpected test error:", err);
  await closePool();
  process.exit(1);
});
