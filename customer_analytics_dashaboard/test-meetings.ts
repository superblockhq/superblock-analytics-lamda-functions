/**
 * Local automated verification script for Analytics Studio Meetings Lambda handlers.
 * Connects to PostgreSQL on localhost:5433 (via running SSH tunnel) to verify
 * real queries, validation, parameterization, insertion, retrieval, and cleanup.
 */
import { execSync } from "node:child_process";
import {
  getMeetingsHandler,
  createMeetingHandler,
  handler,
  query,
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

async function runMeetingsTests() {
  console.log("=================================================");
  console.log("  Running Analytics Studio Meetings Lambda Tests ");
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

  // 1. Initial count check
  console.log("[Check 1] Checking initial row count of public.meetings...");
  const initialRes = await query<{ count: number }>(
    "SELECT count(*)::int as count FROM public.meetings;"
  );
  const initialCount = initialRes.rows[0].count;
  console.log(`  Initial public.meetings count: ${initialCount}`);
  assert(initialCount === 0, "Initial public.meetings row count should be 0");

  // 2. GET meetings validation
  console.log("\n[Test 1] getMeetingsHandler - Validation on missing customerId");
  const res1 = await getMeetingsHandler({ queryStringParameters: {} });
  assert(res1.statusCode === 400, "Should return HTTP 400");
  const body1 = JSON.parse(res1.body);
  assert(body1.success === false, "success should be false");
  assert(body1.error.includes("Missing required parameter"), "Error should report missing customerId");

  // 3. POST meetings validation - missing body
  console.log("\n[Test 2] createMeetingHandler - Validation on missing body");
  const res2 = await createMeetingHandler({});
  assert(res2.statusCode === 400, "Should return HTTP 400");
  const body2 = JSON.parse(res2.body);
  assert(body2.error.includes("Request body is required"), "Error should report missing body");

  // 4. POST meetings validation - missing title
  console.log("\n[Test 3] createMeetingHandler - Validation on missing title");
  const hqUuid = "68c25624-2c0d-41ed-a2c0-0f503ac73033";
  const res3 = await createMeetingHandler({
    body: JSON.stringify({ customerId: hqUuid }),
  });
  assert(res3.statusCode === 400, "Should return HTTP 400");
  const body3 = JSON.parse(res3.body);
  assert(body3.error.includes("Missing required field: 'title'"), "Error should report missing title");

  // 5. POST meetings validation - non-existent customer
  console.log("\n[Test 4] createMeetingHandler - Non-existent customer identifier");
  const res4 = await createMeetingHandler({
    body: JSON.stringify({
      customerId: "00000000-0000-0000-0000-000000000000",
      title: "Non-existent Customer Meeting",
    }),
  });
  assert(res4.statusCode === 404, "Should return HTTP 404");
  const body4 = JSON.parse(res4.body);
  assert(body4.error.includes("Customer not found"), "Error should report customer not found");

  // 6. POST meetings validation - invalid date format
  console.log("\n[Test 5] createMeetingHandler - Invalid meetingDate format");
  const res5 = await createMeetingHandler({
    body: JSON.stringify({
      customerId: hqUuid,
      title: "Quarterly Sync",
      meetingDate: "not-a-valid-date",
    }),
  });
  assert(res5.statusCode === 400, "Should return HTTP 400");
  const body5 = JSON.parse(res5.body);
  assert(body5.error.includes("Invalid date format"), "Error should report invalid date format");

  // 7. Insert ONE temporary test meeting with client_user_id resolution
  console.log("\n[Test 6] createMeetingHandler - Insert ONE temporary test meeting (resolving 'superblock')");
  let createdMeetingId: string | null = null;
  const res6 = await createMeetingHandler({
    body: JSON.stringify({
      customerId: "superblock",
      title: "Q4 Strategy & Performance Review",
      description: "Automated verification test meeting for Superblock HQ.",
      meetingDate: "2026-10-15T14:30:00.000Z",
      durationMinutes: 45,
      status: "scheduled",
      meetingUrl: "https://meet.google.com/vfy-meet-test",
    }),
  });

  assert(res6.statusCode === 201, "Should return HTTP 201 Created");
  const body6 = JSON.parse(res6.body);
  assert(body6.success === true, "success should be true");
  assert(body6.meeting && body6.meeting.id, "Should return meeting with generated UUID");
  assert(body6.meeting.title === "Q4 Strategy & Performance Review", "Title should match inserted value");
  assert(body6.meeting.customer_id === hqUuid, "customer_id should resolve to authoritative customer UUID");
  assert(body6.meeting.duration_minutes === 45, "duration_minutes should be 45");
  assert(body6.meeting.status === "scheduled", "status should be 'scheduled'");

  createdMeetingId = body6.meeting.id;
  console.log(`  Temporary meeting created with ID: ${createdMeetingId}`);

  // 8. GET meetings by customer UUID
  console.log("\n[Test 7] getMeetingsHandler - Query by customer UUID");
  const res7 = await getMeetingsHandler({
    queryStringParameters: { customerId: hqUuid },
  });
  assert(res7.statusCode === 200, "Should return HTTP 200");
  const body7 = JSON.parse(res7.body);
  assert(body7.success === true, "success should be true");
  assert(body7.count >= 1, "Count should be at least 1");
  const found7 = body7.meetings.find((m: any) => m.id === createdMeetingId);
  assert(!!found7, "Created meeting should be returned in results");
  assert(found7?.title === "Q4 Strategy & Performance Review", "Meeting fields match");

  // 9. GET meetings by client_user_id
  console.log("\n[Test 8] getMeetingsHandler - Query by client_user_id ('superblock')");
  const res8 = await getMeetingsHandler({
    queryStringParameters: { customerId: "superblock" },
  });
  assert(res8.statusCode === 200, "Should return HTTP 200");
  const body8 = JSON.parse(res8.body);
  assert(body8.success === true, "success should be true");
  const found8 = body8.meetings.find((m: any) => m.id === createdMeetingId);
  assert(!!found8, "Created meeting should be returned when querying by client_user_id");

  // 10. Unified router dispatching
  console.log("\n[Test 9] Unified handler - Route dispatching for /meetings");
  const res9 = await handler({
    httpMethod: "GET",
    path: "/meetings",
    queryStringParameters: { customerId: "superblock" },
  });
  assert(res9.statusCode === 200, "GET /meetings should dispatch cleanly via router");
  const body9 = JSON.parse(res9.body);
  assert(body9.success === true, "Router response success should be true");

  // 11. Cleanup: Delete the temporary test meeting
  console.log("\n[Cleanup] Deleting temporary test meeting...");
  if (createdMeetingId) {
    const deleteRes = await query(
      "DELETE FROM public.meetings WHERE id = $1 RETURNING id::text;",
      [createdMeetingId]
    );
    assert(deleteRes.rows.length === 1, "Temporary meeting was successfully deleted");
  }

  // 12. Final count check
  console.log("\n[Check 2] Verifying final row count of public.meetings...");
  const finalRes = await query<{ count: number }>(
    "SELECT count(*)::int as count FROM public.meetings;"
  );
  const finalCount = finalRes.rows[0].count;
  console.log(`  Final public.meetings count: ${finalCount}`);
  assert(finalCount === 0, "Final public.meetings row count should be exactly 0 (no test data left)");

  console.log("\n=================================================");
  console.log(`  Meetings Test Results: ${passed} Passed, ${failed} Failed`);
  console.log("=================================================");

  await closePool();

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMeetingsTests().catch(async (err) => {
  console.error("Unexpected test error:", err);
  await closePool();
  process.exit(1);
});
