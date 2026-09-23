import { query, closePool } from "./db";

async function main() {
  process.env.DB_HOST = "127.0.0.1";
  process.env.DB_PORT = "5433";
  process.env.DB_NAME = "superblockhq";
  process.env.DB_USER = "superblockhq";
  process.env.DB_SSL = "true";

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

  for (const table of tables) {
    const result = await query(
      `SELECT count(*)::int AS count FROM public.${table}`
    );
    console.log(`${table}: ${result.rows[0].count}`);
  }

  const contacts = await query(
    "SELECT id, contact_name FROM public.contacts WHERE contact_name = $1",
    ["Verification Contact"]
  );
  console.log("Verification contacts:", contacts.rows);

  const offerings = await query(
    "SELECT id, offering_name FROM public.customer_offerings WHERE offering_name = $1",
    ["Dedicated Tam Support Tier"]
  );
  console.log("Verification offerings:", offerings.rows);

  await closePool();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
