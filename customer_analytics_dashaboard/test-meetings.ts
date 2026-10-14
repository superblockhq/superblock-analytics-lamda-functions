/**
 * Automated verification script verifying that Meetings Lambda handlers and routes
 * have been cleanly removed from the unified router (returning 404).
 */
import { handler } from "./index";

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
  } else {
    console.error(`  FAIL: ${msg}`);
    process.exit(1);
  }
}

async function runMeetingsRemovalTests() {
  console.log("=================================================");
  console.log("  Verifying Meetings Lambda Removal (404 Checks) ");
  console.log("=================================================\n");

  let passed = 0;

  // 1. Path-based route checks
  console.log("[Test 1] Verifying path-based /meetings routes return HTTP 404");
  const getRes = await handler({
    httpMethod: "GET",
    path: "/meetings",
    queryStringParameters: { customerId: "superblock" },
  });
  assert(getRes.statusCode === 404, "GET /meetings returns 404");
  passed++;

  const postRes = await handler({
    httpMethod: "POST",
    path: "/meetings",
    body: JSON.stringify({ customerId: "superblock", title: "Test Sync" }),
  });
  assert(postRes.statusCode === 404, "POST /meetings returns 404");
  passed++;

  const putRes = await handler({
    httpMethod: "PUT",
    path: "/meetings/test-meeting-id",
    body: JSON.stringify({ title: "Updated Title" }),
  });
  assert(putRes.statusCode === 404, "PUT /meetings/:id returns 404");
  passed++;

  const deleteRes = await handler({
    httpMethod: "DELETE",
    path: "/meetings/test-meeting-id",
  });
  assert(deleteRes.statusCode === 404, "DELETE /meetings/:id returns 404");
  passed++;

  // 2. Action query parameter checks
  console.log("\n[Test 2] Verifying action query parameter dispatch returns HTTP 404");
  const actionGetMeetings = await handler({
    httpMethod: "GET",
    queryStringParameters: { action: "get_meetings", customerId: "superblock" },
  });
  assert(actionGetMeetings.statusCode === 404, "action=get_meetings returns 404");
  passed++;

  const actionMeetings = await handler({
    httpMethod: "GET",
    queryStringParameters: { action: "meetings", customerId: "superblock" },
  });
  assert(actionMeetings.statusCode === 404, "action=meetings returns 404");
  passed++;

  const actionCreateMeeting = await handler({
    httpMethod: "POST",
    queryStringParameters: { action: "create_meeting" },
    body: JSON.stringify({ customerId: "superblock", title: "Test" }),
  });
  assert(actionCreateMeeting.statusCode === 404, "action=create_meeting returns 404");
  passed++;

  const actionUpdateMeeting = await handler({
    httpMethod: "PUT",
    queryStringParameters: { action: "update_meeting" },
    body: JSON.stringify({ id: "test", title: "Test" }),
  });
  assert(actionUpdateMeeting.statusCode === 404, "action=update_meeting returns 404");
  passed++;

  const actionDeleteMeeting = await handler({
    httpMethod: "DELETE",
    queryStringParameters: { action: "delete_meeting" },
  });
  assert(actionDeleteMeeting.statusCode === 404, "action=delete_meeting returns 404");
  passed++;

  // 3. Root introspection check
  console.log("\n[Test 3] Verifying root introspection excludes 'meetings'");
  const rootRes = await handler({ httpMethod: "GET", path: "/" });
  assert(rootRes.statusCode === 200, "Root returns HTTP 200");
  const rootBody = JSON.parse(rootRes.body);
  assert(
    !rootBody.supportedEntities.includes("meetings"),
    "supportedEntities does NOT include 'meetings'"
  );
  passed++;

  console.log("\n=================================================");
  console.log(`  Meetings Removal Verification: ${passed} Passed, 0 Failed`);
  console.log("=================================================");
}

runMeetingsRemovalTests().catch((err) => {
  console.error("Unexpected test error:", err);
  process.exit(1);
});
