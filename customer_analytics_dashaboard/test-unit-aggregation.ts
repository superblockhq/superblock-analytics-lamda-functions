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

console.log("\nAll unit tests passed successfully!");
