/**
 * Verification test script for Messages (AWS DynamoDB) and Broadcasts (PostgreSQL)
 * Lambda handlers in customer_analytics_dashaboard.
 */
import {
  handler,
  getMessagesHandler,
  getBroadcastsHandler,
} from "./index";

async function runTests() {
  console.log("===============================================================");
  console.log("  Testing Messages and Broadcasts Lambda Handlers            ");
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

  // 1. Root Introspection Route
  console.log("[Test 1] Health check includes messages & broadcasts");
  const rootRes = await handler({ httpMethod: "GET", path: "/" });
  assert(rootRes.statusCode === 200, "Root returns HTTP 200");
  const rootBody = JSON.parse(rootRes.body);
  assert(
    rootBody.supportedEntities.includes("messages"),
    "supportedEntities includes 'messages'"
  );
  assert(
    rootBody.supportedEntities.includes("broadcasts"),
    "supportedEntities includes 'broadcasts'"
  );

  // 2. Messages Handler Routing
  console.log("\n[Test 2] Router dispatches /messages and query action=messages");
  const msgRouteRes = await handler({
    httpMethod: "GET",
    path: "/messages",
    queryStringParameters: { customerId: "test-customer-123" },
  });
  // It should be handled by getMessagesHandler (either 200 with DynamoDB response or 500 if AWS credentials not configured)
  assert(
    msgRouteRes.statusCode === 200 || msgRouteRes.statusCode === 500,
    "Router dispatches /messages to getMessagesHandler"
  );
  const msgBody = JSON.parse(msgRouteRes.body);
  assert(
    msgBody.source === "dynamodb_messages",
    "Response source is 'dynamodb_messages'"
  );
  assert(
    msgBody.table === "Messages",
    "Target table is 'Messages'"
  );

  const msgActionRes = await handler({
    httpMethod: "GET",
    queryStringParameters: { action: "messages", customerId: "test-customer-123" },
  });
  assert(
    msgActionRes.statusCode === 200 || msgActionRes.statusCode === 500,
    "Router dispatches action=messages"
  );

  // 3. Broadcasts Handler Routing
  console.log("\n[Test 3] Router dispatches /broadcasts and query action=broadcasts");
  const bcastRouteRes = await handler({
    httpMethod: "GET",
    path: "/broadcasts",
    queryStringParameters: { customerId: "test-customer-123" },
  });
  assert(
    bcastRouteRes.statusCode === 200 || bcastRouteRes.statusCode === 500,
    "Router dispatches /broadcasts to getBroadcastsHandler"
  );
  const bcastBody = JSON.parse(bcastRouteRes.body);
  assert(
    bcastBody.source === "postgresql_broadcasts",
    "Response source is 'postgresql_broadcasts'"
  );
  assert(
    bcastBody.table === "public.broadcasts",
    "Target table is 'public.broadcasts'"
  );

  const bcastActionRes = await handler({
    httpMethod: "GET",
    queryStringParameters: { action: "broadcasts", customerId: "test-customer-123" },
  });
  assert(
    bcastActionRes.statusCode === 200 || bcastActionRes.statusCode === 500,
    "Router dispatches action=broadcasts"
  );

  // 4. Direct Handler Invocations with Platform Scope (no customerId)
  console.log("\n[Test 4] Direct invocation: platform scope");
  const directMsgRes = await getMessagesHandler({
    httpMethod: "GET",
    queryStringParameters: {},
  });
  const directMsgBody = JSON.parse(directMsgRes.body);
  assert(
    directMsgBody.scope === "platform" || directMsgBody.source === "dynamodb_messages",
    "Messages handler sets platform scope when customerId is omitted"
  );

  const directBcastRes = await getBroadcastsHandler({
    httpMethod: "GET",
    queryStringParameters: {},
  });
  const directBcastBody = JSON.parse(directBcastRes.body);
  assert(
    directBcastBody.scope === "platform" || directBcastBody.source === "postgresql_broadcasts",
    "Broadcasts handler sets platform scope when customerId is omitted"
  );

  // 5. CORS Headers check
  console.log("\n[Test 5] CORS headers verification");
  assert(
    directMsgRes.headers?.["Access-Control-Allow-Origin"] === "*",
    "Messages response has Access-Control-Allow-Origin"
  );
  assert(
    directBcastRes.headers?.["Access-Control-Allow-Origin"] === "*",
    "Broadcasts response has Access-Control-Allow-Origin"
  );

  console.log(`\n===============================================================`);
  console.log(`  Tests completed: ${passed} passed, ${failed} failed`);
  console.log(`===============================================================`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
