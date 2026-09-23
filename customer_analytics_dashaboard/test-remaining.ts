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
  getContactsHandler,
  createContactHandler,
  getCustomerOfferingsHandler,
  createCustomerOfferingHandler,
  getInvoicesHandler,
  createInvoiceHandler,
  getUsageMetricsHandler,
  createUsageMetricHandler,
  getActivitiesHandler,
  createActivityHandler,
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
    "contacts",
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
  // 1. public.contacts
  // -------------------------------------------------------------
  console.log("\n--- [1] Testing public.contacts ---");
  let createdContactId: string | null = null;
  try {
    // Validation
    const cValRes = await createContactHandler({ body: JSON.stringify({ customerId: "superblock" }) });
    assert(cValRes.statusCode === 400, "contacts: missing contactName / phone returns 400");

    // Insert with valid UUID for contact_id
    const testContactUuid = "d1111111-1111-1111-1111-111111111111";
    const cInsRes = await createContactHandler({
      body: JSON.stringify({
        customerId: "superblock",
        contactId: testContactUuid,
        contactName: "Temp Verification Contact",
        phone: "+15551234567",
        email: "temp.contact.verif@example.com",
      }),
    });
    assert(cInsRes.statusCode === 201, "contacts: insert returns 201");
    const cInsBody = JSON.parse(cInsRes.body);
    createdContactId = cInsBody.contact?.id;
    assert(!!createdContactId, "contacts: returned contact has generated UUID id");
    assert(cInsBody.contact?.contact_id === testContactUuid, "contacts: returned contact preserved valid UUID contact_id");

    // GET retrieval
    const cGetRes = await getContactsHandler({ queryStringParameters: { customerId: "superblock" } });
    assert(cGetRes.statusCode === 200, "contacts: GET returns 200");
    const cGetBody = JSON.parse(cGetRes.body);
    assert(Array.isArray(cGetBody.contacts), "contacts: response contains contacts array");
    const foundContact = cGetBody.contacts.find((c: any) => c.id === createdContactId);
    assert(!!foundContact, "contacts: GET retrieval found inserted temporary contact by id");
    assert(foundContact?.contact_name === "Temp Verification Contact", "contacts: contact name matches");

    // Router dispatch
    const cRouteRes = await handler({
      httpMethod: "GET",
      path: "/contacts",
      queryStringParameters: { customerId: "superblock" },
    });
    assert(cRouteRes.statusCode === 200, "contacts: router GET /contacts returns 200");
  } finally {
    // Exact cleanup by ID
    if (createdContactId) {
      const del = await query("DELETE FROM public.contacts WHERE id = $1 RETURNING id::text;", [createdContactId]);
      assert(del.rows.length === 1, "contacts: cleaned up exact temporary record by ID");
    }
  }

  // -------------------------------------------------------------
  // 2. public.customer_offerings
  // -------------------------------------------------------------
  console.log("\n--- [2] Testing public.customer_offerings ---");
  let createdOfferingId: string | null = null;
  try {
    // Validation
    const coValRes = await createCustomerOfferingHandler({ body: JSON.stringify({ customerId: "superblock" }) });
    assert(coValRes.statusCode === 400, "customer_offerings: missing offeringName returns 400");

    // Insert
    const coInsRes = await createCustomerOfferingHandler({
      body: JSON.stringify({
        customerId: "superblock",
        offeringName: "Temp Focus Verification Offering",
        status: "active",
      }),
    });
    assert(coInsRes.statusCode === 201, "customer_offerings: insert returns 201");
    const coInsBody = JSON.parse(coInsRes.body);
    createdOfferingId = coInsBody.customerOffering?.id || coInsBody.offering?.id;
    assert(!!createdOfferingId, "customer_offerings: returned record has generated UUID id");

    // GET retrieval
    const coGetRes = await getCustomerOfferingsHandler({ queryStringParameters: { customerId: "superblock" } });
    assert(coGetRes.statusCode === 200, "customer_offerings: GET returns 200");
    const coGetBody = JSON.parse(coGetRes.body);
    const offeringsList = coGetBody.customerOfferings || coGetBody.offerings;
    assert(Array.isArray(offeringsList), "customer_offerings: response contains offerings array");
    const foundOffering = offeringsList.find((o: any) => o.id === createdOfferingId);
    assert(!!foundOffering, "customer_offerings: GET retrieval found inserted temporary offering by id");

    // Router dispatch
    const coRouteRes = await handler({
      httpMethod: "GET",
      path: "/customer-offerings",
      queryStringParameters: { customerId: "superblock" },
    });
    assert(coRouteRes.statusCode === 200, "customer_offerings: router GET /customer-offerings returns 200");
  } finally {
    // Exact cleanup by ID
    if (createdOfferingId) {
      const del = await query("DELETE FROM public.customer_offerings WHERE id = $1 RETURNING id::text;", [createdOfferingId]);
      assert(del.rows.length === 1, "customer_offerings: cleaned up exact temporary record by ID");
    }
  }

  // -------------------------------------------------------------
  // 3. public.invoices
  // -------------------------------------------------------------
  console.log("\n--- [3] Testing public.invoices ---");
  let createdInvoiceId: string | null = null;
  try {
    // Validation
    const invValRes = await createInvoiceHandler({ body: JSON.stringify({ customerId: "superblock" }) });
    assert(invValRes.statusCode === 400, "invoices: missing amount returns 400");

    // Insert
    const invNumber = `INV-FOCUS-${Date.now().toString().slice(-6)}`;
    const invInsRes = await createInvoiceHandler({
      body: JSON.stringify({
        customerId: "superblock",
        invoiceNumber: invNumber,
        amount: 1450.75,
        currency: "USD",
        status: "draft",
        description: "Temporary Focused Retainer Invoice",
      }),
    });
    assert(invInsRes.statusCode === 201, "invoices: insert returns 201");
    const invInsBody = JSON.parse(invInsRes.body);
    createdInvoiceId = invInsBody.invoice?.id;
    assert(!!createdInvoiceId, "invoices: returned invoice has generated UUID id");

    // GET retrieval
    const invGetRes = await getInvoicesHandler({ queryStringParameters: { customerId: "superblock" } });
    assert(invGetRes.statusCode === 200, "invoices: GET returns 200");
    const invGetBody = JSON.parse(invGetRes.body);
    assert(Array.isArray(invGetBody.invoices), "invoices: response contains invoices array");
    const foundInvoice = invGetBody.invoices.find((i: any) => i.id === createdInvoiceId);
    assert(!!foundInvoice, "invoices: GET retrieval found inserted temporary invoice by id");

    // Router dispatch
    const invRouteRes = await handler({
      httpMethod: "GET",
      path: "/invoices",
      queryStringParameters: { customerId: "superblock" },
    });
    assert(invRouteRes.statusCode === 200, "invoices: router GET /invoices returns 200");
  } finally {
    // Exact cleanup by ID
    if (createdInvoiceId) {
      const del = await query("DELETE FROM public.invoices WHERE id = $1 RETURNING id::text;", [createdInvoiceId]);
      assert(del.rows.length === 1, "invoices: cleaned up exact temporary record by ID");
    }
  }

  // -------------------------------------------------------------
  // 4. public.usage_metrics
  // -------------------------------------------------------------
  console.log("\n--- [4] Testing public.usage_metrics ---");
  let createdMetricId: string | null = null;
  try {
    // Validation
    const umValRes = await createUsageMetricHandler({ body: JSON.stringify({ customerId: "superblock" }) });
    assert(umValRes.statusCode === 400, "usage_metrics: missing metricName returns 400");

    // Insert
    const metricName = `focus_test_metric_${Date.now().toString().slice(-4)}`;
    const umInsRes = await createUsageMetricHandler({
      body: JSON.stringify({
        customerId: "superblock",
        metricName,
        metricValue: 512,
        metricUnit: "req/s",
      }),
    });
    assert(umInsRes.statusCode === 201, "usage_metrics: insert returns 201");
    const umInsBody = JSON.parse(umInsRes.body);
    createdMetricId = umInsBody.usageMetric?.id;
    assert(!!createdMetricId, "usage_metrics: returned metric has generated UUID id");

    // GET retrieval
    const umGetRes = await getUsageMetricsHandler({ queryStringParameters: { customerId: "superblock" } });
    assert(umGetRes.statusCode === 200, "usage_metrics: GET returns 200");
    const umGetBody = JSON.parse(umGetRes.body);
    assert(Array.isArray(umGetBody.usageMetrics), "usage_metrics: response contains usageMetrics array");
    const foundMetric = umGetBody.usageMetrics.find((u: any) => u.id === createdMetricId);
    assert(!!foundMetric, "usage_metrics: GET retrieval found inserted temporary metric by id");

    // Router dispatch
    const umRouteRes = await handler({
      httpMethod: "GET",
      path: "/usage-metrics",
      queryStringParameters: { customerId: "superblock" },
    });
    assert(umRouteRes.statusCode === 200, "usage_metrics: router GET /usage-metrics returns 200");
  } finally {
    // Exact cleanup by ID
    if (createdMetricId) {
      const del = await query("DELETE FROM public.usage_metrics WHERE id = $1 RETURNING id::text;", [createdMetricId]);
      assert(del.rows.length === 1, "usage_metrics: cleaned up exact temporary record by ID");
    }
  }

  // -------------------------------------------------------------
  // 5. public.activities
  // -------------------------------------------------------------
  console.log("\n--- [5] Testing public.activities ---");
  let createdActivityId: string | null = null;
  try {
    // Validation
    const actValRes = await createActivityHandler({ body: JSON.stringify({ customerId: "superblock" }) });
    assert(actValRes.statusCode === 400, "activities: missing activityType returns 400");

    // Insert (with valid UUID for performedBy: hqUuid)
    const actType = `focus_audit_${Date.now().toString().slice(-4)}`;
    const actInsRes = await createActivityHandler({
      body: JSON.stringify({
        customerId: "superblock",
        activityType: actType,
        title: "Focused Verification Activity",
        description: "Validating activity creation with valid UUID performedBy",
        performedBy: hqUuid,
      }),
    });
    assert(actInsRes.statusCode === 201, "activities: insert returns 201");
    const actInsBody = JSON.parse(actInsRes.body);
    createdActivityId = actInsBody.activity?.id;
    assert(!!createdActivityId, "activities: returned activity has generated UUID id");
    assert(actInsBody.activity?.performed_by === hqUuid, "activities: performed_by matches customer UUID");

    // GET retrieval
    const actGetRes = await getActivitiesHandler({ queryStringParameters: { customerId: "superblock" } });
    assert(actGetRes.statusCode === 200, "activities: GET returns 200");
    const actGetBody = JSON.parse(actGetRes.body);
    assert(Array.isArray(actGetBody.activities), "activities: response contains activities array");
    const foundActivity = actGetBody.activities.find((a: any) => a.id === createdActivityId);
    assert(!!foundActivity, "activities: GET retrieval found inserted temporary activity by id");

    // Router dispatch
    const actRouteRes = await handler({
      httpMethod: "GET",
      path: "/activities",
      queryStringParameters: { customerId: "superblock" },
    });
    assert(actRouteRes.statusCode === 200, "activities: router GET /activities returns 200");
  } finally {
    // Exact cleanup by ID
    if (createdActivityId) {
      const del = await query("DELETE FROM public.activities WHERE id = $1 RETURNING id::text;", [createdActivityId]);
      assert(del.rows.length === 1, "activities: cleaned up exact temporary record by ID");
    }
  }

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
