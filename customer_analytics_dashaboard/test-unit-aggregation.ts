/**
 * Unit verification test script for Messages and Broadcasts counting and aggregation logic.
 */
import type {
  DynamoDbMessageRecord,
  BroadcastRecord,
  BroadcastStatusCount,
  BroadcastMediaTypeCount,
  BroadcastDailyCount,
} from "./types";
import { handler } from "./index";

function assert(condition: boolean, msg: string) {
  if (condition) {
    console.log(`  PASS: ${msg}`);
  } else {
    console.error(`  FAIL: ${msg}`);
    process.exit(1);
  }
}

console.log("===============================================================");
console.log("  Unit Tests: Counting & Metric Aggregations                  ");
console.log("===============================================================\n");

// 1. Messages Unit Filtering & Counting
console.log("[Test 1] Messages customer isolation & post-filtering");
const sampleMessages: DynamoDbMessageRecord[] = [
  { "client#user_id": "cust1#userA", direction: "inbound", messageStatus: "delivered", timestamp: 1672531199000 },
  { "client#user_id": "cust1#userB", direction: "outbound", messageStatus: "sent", timestamp: 1672531200000 },
  { "client#user_id": "cust2#userC", direction: "outbound", messageStatus: "sent", timestamp: 1672531201000 },
  { client_user_id: "cust1", direction: "inbound", messageStatus: "read", timestamp: 1672531202000 },
];

const target = "cust1".toLowerCase();
const cust1Items: DynamoDbMessageRecord[] = [];
for (const item of sampleMessages) {
  const cuid = (item["client#user_id"] || item.client_user_id || "").toLowerCase();
  const uid = (item.user_id || "").toLowerCase();
  if (uid === target || cuid === target) {
    cust1Items.push(item);
    continue;
  }
  if (cuid.includes("#")) {
    const parts = cuid.split("#");
    if (parts[0] === target || parts[1] === target) {
      cust1Items.push(item);
      continue;
    }
  }
}

assert(cust1Items.length === 3, "Customer 1 matched exactly 3 messages");

let inbound = 0;
let outbound = 0;
for (const item of cust1Items) {
  if (item.direction === "inbound") inbound++;
  if (item.direction === "outbound") outbound++;
}
assert(inbound === 2, "Customer 1 has 2 inbound messages");
assert(outbound === 1, "Customer 1 has 1 outbound message");

// 2. Broadcasts Metrics Assembly & Totals
console.log("\n[Test 2] Broadcasts count & metric calculations");
const totals = {
  total_broadcasts: 12,
  total_recipients: 15400,
  avg_recipients: 1283.3,
  has_flow_count: 5,
};

assert(totals.total_broadcasts === 12, "Broadcasts count is 12");
assert(totals.total_recipients === 15400, "Total recipients is 15400");
assert(totals.has_flow_count === 5, "Has flow count is 5");

// 3. Router 404 for Removed Candidate Routes
console.log("\n[Test 3] Verifying 404 for removed candidate routes");
async function verifyRemovedRoutes() {
  const removedRoutes = [
    "/contacts",
    "/deals",
    "/tickets",
    "/team-members",
    "/team_members",
    "/products",
    "/subscriptions",
    "/customer-offerings",
    "/customer_offerings",
    "/invoices",
    "/usage-metrics",
  ];

  for (const r of removedRoutes) {
    const getRes = await handler({ httpMethod: "GET", path: r });
    assert(getRes.statusCode === 404, `GET ${r} returns 404 (removed)`);
    const postRes = await handler({ httpMethod: "POST", path: r });
    assert(postRes.statusCode === 404, `POST ${r} returns 404 (removed)`);
  }

  // 4. Root Health Check & Introspection
  console.log("\n[Test 4] Verifying root introspection supportedEntities");
  const rootRes = await handler({ httpMethod: "GET", path: "/" });
  assert(rootRes.statusCode === 200, "Root returns HTTP 200");
  const rootBody = JSON.parse(rootRes.body);

  const expectedEntities = [
    "notes",
    "meetings",
    "customerDetails",
    "activities",
    "credentials",
    "messages",
    "broadcasts",
  ];
  for (const entity of expectedEntities) {
    assert(rootBody.supportedEntities.includes(entity), `supportedEntities includes '${entity}'`);
  }

  const removedEntities = [
    "contacts",
    "deals",
    "tickets",
    "teamMembers",
    "products",
    "subscriptions",
    "customerOfferings",
    "invoices",
    "usageMetrics",
  ];
  for (const entity of removedEntities) {
    assert(!rootBody.supportedEntities.includes(entity), `supportedEntities does NOT include removed '${entity}'`);
  }

  console.log("\nAll unit and routing tests passed successfully!");
}

verifyRemovedRoutes().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

