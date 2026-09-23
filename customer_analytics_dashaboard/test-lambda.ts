/**
 * Local automated verification script for Analytics Studio Lambda handlers.
 * Connects to PostgreSQL on localhost:5433 (via running tunnel) to verify
 * real queries, validation, parameterization, and responses without inserting fake data.
 */
import { execSync } from "node:child_process";
import {
  getNotesHandler,
  createNoteHandler,
  getCustomerDetailsHandler,
  listCustomerDetailsHandler,
  handler,
  closePool,
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

async function runTests() {
  console.log("=================================================");
  console.log("  Running Analytics Studio Lambda Test Suite     ");
  console.log("=================================================\n");

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

  // TEST 1: getNotesHandler - missing customerId validation
  console.log("[Test 1] getNotesHandler - Validation when customerId is missing");
  const res1 = await getNotesHandler({ queryStringParameters: {} });
  assert(res1.statusCode === 400, "Should return HTTP 400");
  const body1 = JSON.parse(res1.body);
  assert(body1.success === false, "success should be false");
  assert(body1.error.includes("Missing required parameter"), "Should contain clear error message");

  // TEST 2: getNotesHandler - query with Superblock HQ UUID
  console.log("\n[Test 2] getNotesHandler - Query with valid customer UUID");
  const hqUuid = "68c25624-2c0d-41ed-a2c0-0f503ac73033";
  const res2 = await getNotesHandler({
    queryStringParameters: { customerId: hqUuid },
  });
  assert(res2.statusCode === 200, "Should return HTTP 200");
  const body2 = JSON.parse(res2.body);
  assert(body2.success === true, "success should be true");
  assert(Array.isArray(body2.notes), "notes should be an array");
  console.log(`  Retrieved ${body2.notes.length} notes for HQ UUID`);

  // TEST 3: getNotesHandler - query with client_user_id
  console.log("\n[Test 3] getNotesHandler - Query resolving client_user_id ('superblock')");
  const res3 = await getNotesHandler({
    queryStringParameters: { customerId: "superblock" },
  });
  assert(res3.statusCode === 200, "Should return HTTP 200");
  const body3 = JSON.parse(res3.body);
  assert(body3.success === true, "success should be true");
  assert(Array.isArray(body3.notes), "notes should be an array");

  // TEST 4: createNoteHandler - missing body validation
  console.log("\n[Test 4] createNoteHandler - Validation on missing request body");
  const res4 = await createNoteHandler({});
  assert(res4.statusCode === 400, "Should return HTTP 400");
  const body4 = JSON.parse(res4.body);
  assert(body4.error.includes("Request body is required"), "Error should report missing body");

  // TEST 5: createNoteHandler - missing content validation
  console.log("\n[Test 5] createNoteHandler - Validation on missing note content");
  const res5 = await createNoteHandler({
    body: JSON.stringify({ customerId: hqUuid, title: "Test Note" }),
  });
  assert(res5.statusCode === 400, "Should return HTTP 400");
  const body5 = JSON.parse(res5.body);
  assert(body5.error.includes("Missing required field: 'content'"), "Error should report missing content");

  // TEST 6: createNoteHandler - non-existent customer validation
  console.log("\n[Test 6] createNoteHandler - Non-existent customer identifier");
  const res6 = await createNoteHandler({
    body: JSON.stringify({
      customerId: "00000000-0000-0000-0000-000000000000",
      content: "Sample context",
    }),
  });
  assert(res6.statusCode === 404, "Should return HTTP 404");
  const body6 = JSON.parse(res6.body);
  assert(body6.error.includes("Customer not found"), "Error should report customer not found");

  // TEST 7: getCustomerDetailsHandler - single customer query by UUID
  console.log("\n[Test 7] getCustomerDetailsHandler - Query real customer by UUID");
  const res7 = await getCustomerDetailsHandler({
    queryStringParameters: { id: hqUuid },
  });
  assert(res7.statusCode === 200, "Should return HTTP 200");
  const body7 = JSON.parse(res7.body);
  assert(body7.success === true, "success should be true");
  assert(body7.customer.id === hqUuid, "Customer ID should match requested UUID");
  assert(body7.customer.customer_name === "Superblock HQ", "Customer name should match DB record");
  console.log(`  Customer: "${body7.customer.customer_name}" | Client ID: "${body7.customer.client_user_id}"`);

  // TEST 8: getCustomerDetailsHandler - query by client_user_id
  console.log("\n[Test 8] getCustomerDetailsHandler - Query real customer by client_user_id ('geniq')");
  const res8 = await getCustomerDetailsHandler({
    queryStringParameters: { clientUserId: "geniq" },
  });
  assert(res8.statusCode === 200, "Should return HTTP 200");
  const body8 = JSON.parse(res8.body);
  assert(body8.customer.customer_name === "Geniq healthtech", "Customer name should match");

  // TEST 9: listCustomerDetailsHandler - pagination
  console.log("\n[Test 9] listCustomerDetailsHandler - Pagination (limit=5)");
  const res9 = await listCustomerDetailsHandler({
    queryStringParameters: { limit: "5", offset: "0" },
  });
  assert(res9.statusCode === 200, "Should return HTTP 200");
  const body9 = JSON.parse(res9.body);
  assert(body9.count === 5, "Count should be exactly 5");
  assert(body9.customers.length === 5, "Should return 5 customer records");

  // TEST 10: Unified Router - path dispatching
  console.log("\n[Test 10] Unified handler - Route dispatching");
  const res10a = await handler({
    httpMethod: "GET",
    path: "/notes",
    queryStringParameters: { customerId: hqUuid },
  });
  assert(res10a.statusCode === 200, "GET /notes should dispatch to getNotesHandler");

  const res10b = await handler({
    httpMethod: "GET",
    path: "/customer-details",
    queryStringParameters: { limit: "2" },
  });
  assert(res10b.statusCode === 200, "GET /customer-details should dispatch to listCustomerDetailsHandler");

  const res10c = await handler({
    httpMethod: "DELETE",
    path: "/unknown",
  });
  assert(res10c.statusCode === 404, "Unknown route should return HTTP 404");

  console.log("\n=================================================");
  console.log(`  Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  await closePool();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(async (err) => {
  console.error("Unexpected test error:", err);
  await closePool();
  process.exit(1);
});
