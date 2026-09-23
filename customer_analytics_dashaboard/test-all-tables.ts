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
  getContactsHandler,
  createContactHandler,
  getDealsHandler,
  createDealHandler,
  getTicketsHandler,
  createTicketHandler,
  getTeamMembersHandler,
  createTeamMemberHandler,
  getProductsHandler,
  createProductHandler,
  getSubscriptionsHandler,
  createSubscriptionHandler,
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
    "contacts",
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
  // 1. public.contacts
  // -------------------------------------------------------------
  console.log("\n--- [Table 1] public.contacts ---");
  // 1.1 Validation
  const cValRes = await createContactHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(cValRes.statusCode === 400, "contacts: missing contactName / phone returns 400");

  // 1.2 Insert
  let contactId: string | null = null;
  const testContactUuid = "d1111111-1111-1111-1111-111111111111";
  const cInsRes = await createContactHandler({
    body: JSON.stringify({
      customerId: "superblock",
      contactId: testContactUuid,
      contactName: "Verification Contact",
      phone: "+15551234567",
      email: "verif.contact@example.com",
    }),
  });
  assert(cInsRes.statusCode === 201, "contacts: insert returns 201");
  const cInsBody = JSON.parse(cInsRes.body);
  contactId = cInsBody.contact?.id;

  // 1.3 GET
  const cGetRes = await getContactsHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(cGetRes.statusCode === 200, "contacts: GET returns 200");
  const cGetBody = JSON.parse(cGetRes.body);
  assert(cGetBody.contacts.some((c: any) => c.id === contactId || c.contact_id === testContactUuid), "contacts: newly inserted contact found");

  // 1.4 Route check
  const cRouteRes = await handler({ httpMethod: "GET", path: "/contacts", queryStringParameters: { customerId: "superblock" } });
  assert(cRouteRes.statusCode === 200, "contacts: router GET /contacts returns 200");

  // 1.5 Cleanup
  if (contactId) {
    await query("DELETE FROM public.contacts WHERE id = $1;", [contactId]);
  }

  // -------------------------------------------------------------
  // 2. public.deals
  // -------------------------------------------------------------
  console.log("\n--- [Table 2] public.deals ---");
  // 2.1 Validation
  const dValRes = await createDealHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(dValRes.statusCode === 400, "deals: missing deal name returns 400");

  // 2.2 Insert
  let dealId: string | null = null;
  const dInsRes = await createDealHandler({
    body: JSON.stringify({
      customerId: "superblock",
      dealId: "test-deal-verif-1",
      name: "Enterprise Expansion Deal",
      value: 15000,
      currency: "USD",
      stage: "Negotiation",
    }),
  });
  assert(dInsRes.statusCode === 201, "deals: insert returns 201");
  const dInsBody = JSON.parse(dInsRes.body);
  dealId = dInsBody.deal?.id;

  // 2.3 GET
  const dGetRes = await getDealsHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(dGetRes.statusCode === 200, "deals: GET returns 200");
  const dGetBody = JSON.parse(dGetRes.body);
  assert(dGetBody.deals.some((d: any) => d.deal_id === "test-deal-verif-1"), "deals: inserted deal found");

  // 2.4 Route check
  const dRouteRes = await handler({ httpMethod: "GET", path: "/deals", queryStringParameters: { customerId: "superblock" } });
  assert(dRouteRes.statusCode === 200, "deals: router GET /deals returns 200");

  // 2.5 Cleanup
  if (dealId) {
    await query("DELETE FROM public.deals WHERE id = $1;", [dealId]);
  }

  // -------------------------------------------------------------
  // 3. public.tickets
  // -------------------------------------------------------------
  console.log("\n--- [Table 3] public.tickets ---");
  // 3.1 Validation
  const tValRes = await createTicketHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(tValRes.statusCode === 400, "tickets: missing subject returns 400");

  // 3.2 Insert
  let ticketId: string | null = null;
  const tInsRes = await createTicketHandler({
    body: JSON.stringify({
      customerId: "superblock",
      ticketId: "test-ticket-verif-1",
      subject: "SSO Login Latency Issue",
      status: "open",
      priority: "high",
    }),
  });
  assert(tInsRes.statusCode === 201, "tickets: insert returns 201");
  const tInsBody = JSON.parse(tInsRes.body);
  ticketId = tInsBody.ticket?.id;

  // 3.3 GET
  const tGetRes = await getTicketsHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(tGetRes.statusCode === 200, "tickets: GET returns 200");
  const tGetBody = JSON.parse(tGetRes.body);
  assert(tGetBody.tickets.some((t: any) => t.ticket_id === "test-ticket-verif-1"), "tickets: inserted ticket found");

  // 3.4 Route check
  const tRouteRes = await handler({ httpMethod: "GET", path: "/tickets", queryStringParameters: { customerId: "superblock" } });
  assert(tRouteRes.statusCode === 200, "tickets: router GET /tickets returns 200");

  // 3.5 Cleanup
  if (ticketId) {
    await query("DELETE FROM public.tickets WHERE id = $1;", [ticketId]);
  }

  // -------------------------------------------------------------
  // 4. public.team_members
  // -------------------------------------------------------------
  console.log("\n--- [Table 4] public.team_members ---");
  // 4.1 Validation
  const tmValRes = await createTeamMemberHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(tmValRes.statusCode === 400, "team_members: missing email/name returns 400");

  // 4.2 Insert
  let tmId: string | null = null;
  const tmInsRes = await createTeamMemberHandler({
    body: JSON.stringify({
      customerId: "superblock",
      email: "engineer.verif@superblockhq.com",
      name: "Alex Verif",
      role: "Lead Engineer",
    }),
  });
  assert(tmInsRes.statusCode === 201, "team_members: insert returns 201");
  const tmInsBody = JSON.parse(tmInsRes.body);
  tmId = tmInsBody.teamMember?.id;

  // 4.3 GET
  const tmGetRes = await getTeamMembersHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(tmGetRes.statusCode === 200, "team_members: GET returns 200");
  const tmGetBody = JSON.parse(tmGetRes.body);
  assert(tmGetBody.teamMembers.some((tm: any) => tm.email === "engineer.verif@superblockhq.com"), "team_members: inserted member found");

  // 4.4 Route check
  const tmRouteRes = await handler({ httpMethod: "GET", path: "/team-members", queryStringParameters: { customerId: "superblock" } });
  assert(tmRouteRes.statusCode === 200, "team_members: router GET /team-members returns 200");

  // 4.5 Cleanup
  if (tmId) {
    await query("DELETE FROM public.team_members WHERE id = $1;", [tmId]);
  }

  // -------------------------------------------------------------
  // 5. public.products
  // -------------------------------------------------------------
  console.log("\n--- [Table 5] public.products ---");
  // 5.1 Validation
  const pValRes = await createProductHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(pValRes.statusCode === 400, "products: missing name returns 400");

  // 5.2 Insert
  let prodId: string | null = null;
  const pInsRes = await createProductHandler({
    body: JSON.stringify({
      customerId: "superblock",
      productId: "test-product-verif-1",
      name: "Security Auditing Suite",
      code: "SAS-100",
      description: "Advanced continuous security scanning",
    }),
  });
  assert(pInsRes.statusCode === 201, "products: insert returns 201");
  const pInsBody = JSON.parse(pInsRes.body);
  prodId = pInsBody.product?.id;

  // 5.3 GET
  const pGetRes = await getProductsHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(pGetRes.statusCode === 200, "products: GET returns 200");
  const pGetBody = JSON.parse(pGetRes.body);
  assert(pGetBody.products.some((p: any) => p.name === "Security Auditing Suite"), "products: inserted product found");

  // 5.4 Route check
  const pRouteRes = await handler({ httpMethod: "GET", path: "/products", queryStringParameters: { customerId: "superblock" } });
  assert(pRouteRes.statusCode === 200, "products: router GET /products returns 200");

  // 5.5 Cleanup
  if (prodId) {
    await query("DELETE FROM public.products WHERE id = $1;", [prodId]);
  }

  // -------------------------------------------------------------
  // 6. public.subscriptions
  // -------------------------------------------------------------
  console.log("\n--- [Table 6] public.subscriptions ---");
  // 6.1 Validation
  const sValRes = await createSubscriptionHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(sValRes.statusCode === 400, "subscriptions: missing planId returns 400");

  // Fetch valid plan id
  const planRes = await query<{ id: string }>("SELECT id::text FROM public.plans LIMIT 1;");
  const validPlanId = planRes.rows[0]?.id;

  // 6.2 Insert
  let subId: string | null = null;
  const sInsRes = await createSubscriptionHandler({
    body: JSON.stringify({
      customerId: "superblock",
      planId: validPlanId,
      status: "active",
      billingCycle: "monthly",
      amount: 499.00,
    }),
  });
  assert(sInsRes.statusCode === 201, "subscriptions: insert returns 201");
  const sInsBody = JSON.parse(sInsRes.body);
  subId = sInsBody.subscription?.id;

  // 6.3 GET
  const sGetRes = await getSubscriptionsHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(sGetRes.statusCode === 200, "subscriptions: GET returns 200");
  const sGetBody = JSON.parse(sGetRes.body);
  assert(sGetBody.subscriptions.some((s: any) => s.id === subId), "subscriptions: inserted subscription found");

  // 6.4 Route check
  const sRouteRes = await handler({ httpMethod: "GET", path: "/subscriptions", queryStringParameters: { customerId: "superblock" } });
  assert(sRouteRes.statusCode === 200, "subscriptions: router GET /subscriptions returns 200");

  // 6.5 Cleanup
  if (subId) {
    await query("DELETE FROM public.subscriptions WHERE id = $1;", [subId]);
  }

  // -------------------------------------------------------------
  // 7. public.customer_offerings
  // -------------------------------------------------------------
  console.log("\n--- [Table 7] public.customer_offerings ---");
  // 7.1 Validation
  const coValRes = await createCustomerOfferingHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(coValRes.statusCode === 400, "customer_offerings: missing offeringName returns 400");

  // 7.2 Insert
  let coId: string | null = null;
  const coInsRes = await createCustomerOfferingHandler({
    body: JSON.stringify({
      customerId: "superblock",
      offeringName: "Dedicated Tam Support Tier",
      status: "active",
    }),
  });
  assert(coInsRes.statusCode === 201, "customer_offerings: insert returns 201");
  const coInsBody = JSON.parse(coInsRes.body);
  coId = coInsBody.customerOffering?.id || coInsBody.offering?.id;

  // 7.3 GET
  const coGetRes = await getCustomerOfferingsHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(coGetRes.statusCode === 200, "customer_offerings: GET returns 200");
  const coGetBody = JSON.parse(coGetRes.body);
  const offeringsList = coGetBody.customerOfferings || coGetBody.offerings;
  assert(offeringsList.some((co: any) => co.id === coId), "customer_offerings: inserted offering found");

  // 7.4 Route check
  const coRouteRes = await handler({ httpMethod: "GET", path: "/customer-offerings", queryStringParameters: { customerId: "superblock" } });
  assert(coRouteRes.statusCode === 200, "customer_offerings: router GET /customer-offerings returns 200");

  // 7.5 Cleanup
  if (coId) {
    await query("DELETE FROM public.customer_offerings WHERE id = $1;", [coId]);
  }

  // -------------------------------------------------------------
  // 8. public.invoices
  // -------------------------------------------------------------
  console.log("\n--- [Table 8] public.invoices ---");
  // 8.1 Validation
  const invValRes = await createInvoiceHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(invValRes.statusCode === 400, "invoices: missing invoiceNumber / amount returns 400");

  // 8.2 Insert
  let invId: string | null = null;
  const invInsRes = await createInvoiceHandler({
    body: JSON.stringify({
      customerId: "superblock",
      invoiceNumber: "INV-VERIF-2026-001",
      amount: 1250.50,
      currency: "USD",
      status: "draft",
      description: "Q3 Analytics Retainer",
    }),
  });
  assert(invInsRes.statusCode === 201, "invoices: insert returns 201");
  const invInsBody = JSON.parse(invInsRes.body);
  invId = invInsBody.invoice?.id;

  // 8.3 GET
  const invGetRes = await getInvoicesHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(invGetRes.statusCode === 200, "invoices: GET returns 200");
  const invGetBody = JSON.parse(invGetRes.body);
  assert(invGetBody.invoices.some((inv: any) => inv.id === invId), "invoices: inserted invoice found");

  // 8.4 Route check
  const invRouteRes = await handler({ httpMethod: "GET", path: "/invoices", queryStringParameters: { customerId: "superblock" } });
  assert(invRouteRes.statusCode === 200, "invoices: router GET /invoices returns 200");

  // 8.5 Cleanup
  if (invId) {
    await query("DELETE FROM public.invoices WHERE id = $1;", [invId]);
  }

  // -------------------------------------------------------------
  // 9. public.usage_metrics
  // -------------------------------------------------------------
  console.log("\n--- [Table 9] public.usage_metrics ---");
  // 9.1 Validation
  const umValRes = await createUsageMetricHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(umValRes.statusCode === 400, "usage_metrics: missing metricName returns 400");

  // 9.2 Insert
  let umId: string | null = null;
  const umInsRes = await createUsageMetricHandler({
    body: JSON.stringify({
      customerId: "superblock",
      metricName: "queries_per_second",
      metricValue: 342,
      metricUnit: "req/s",
    }),
  });
  assert(umInsRes.statusCode === 201, "usage_metrics: insert returns 201");
  const umInsBody = JSON.parse(umInsRes.body);
  umId = umInsBody.usageMetric?.id;

  // 9.3 GET
  const umGetRes = await getUsageMetricsHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(umGetRes.statusCode === 200, "usage_metrics: GET returns 200");
  const umGetBody = JSON.parse(umGetRes.body);
  assert(umGetBody.usageMetrics.some((um: any) => um.id === umId), "usage_metrics: inserted metric found");

  // 9.4 Route check
  const umRouteRes = await handler({ httpMethod: "GET", path: "/usage-metrics", queryStringParameters: { customerId: "superblock" } });
  assert(umRouteRes.statusCode === 200, "usage_metrics: router GET /usage-metrics returns 200");

  // 9.5 Cleanup
  if (umId) {
    await query("DELETE FROM public.usage_metrics WHERE id = $1;", [umId]);
  }

  // -------------------------------------------------------------
  // 10. public.activities
  // -------------------------------------------------------------
  console.log("\n--- [Table 10] public.activities ---");
  // 10.1 Validation
  const actValRes = await createActivityHandler({ body: JSON.stringify({ customerId: "superblock" }) });
  assert(actValRes.statusCode === 400, "activities: missing activityType returns 400");

  // 10.2 Insert
  let actId: string | null = null;
  const actInsRes = await createActivityHandler({
    body: JSON.stringify({
      customerId: "superblock",
      activityType: "security_audit_run",
      title: "Automated Verification Audit",
      description: "Ran continuous integrity check on customer configuration",
      performedBy: hqUuid,
    }),
  });
  assert(actInsRes.statusCode === 201, "activities: insert returns 201");
  const actInsBody = JSON.parse(actInsRes.body);
  actId = actInsBody.activity?.id;

  // 10.3 GET
  const actGetRes = await getActivitiesHandler({ queryStringParameters: { customerId: "superblock" } });
  assert(actGetRes.statusCode === 200, "activities: GET returns 200");
  const actGetBody = JSON.parse(actGetRes.body);
  assert(actGetBody.activities.some((act: any) => act.id === actId), "activities: inserted activity found");

  // 10.4 Route check
  const actRouteRes = await handler({ httpMethod: "GET", path: "/activities", queryStringParameters: { customerId: "superblock" } });
  assert(actRouteRes.statusCode === 200, "activities: router GET /activities returns 200");

  // 10.5 Cleanup
  if (actId) {
    await query("DELETE FROM public.activities WHERE id = $1;", [actId]);
  }

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
