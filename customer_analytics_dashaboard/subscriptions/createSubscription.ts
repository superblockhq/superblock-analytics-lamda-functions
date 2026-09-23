import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  SubscriptionRecord,
  CreateSubscriptionInput,
  CreateSubscriptionResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    str
  );
}

async function resolveCustomerUuid(identifier: string): Promise<string | null> {
  const sql = `
    SELECT id::text 
    FROM public.customers_details 
    WHERE id::text = $1 OR LOWER(client_user_id) = LOWER($1)
    LIMIT 1;
  `;
  const res = await query<{ id: string }>(sql, [identifier]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}

export async function createSubscriptionHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body is required",
        } as CreateSubscriptionResponse),
      };
    }

    let payload: CreateSubscriptionInput;
    try {
      payload =
        typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Invalid JSON format in request body",
        } as CreateSubscriptionResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.customer_id ||
      ""
    ).trim();

    const rawPlanId = (payload.planId || payload.plan_id || "").trim();

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateSubscriptionResponse),
      };
    }

    if (!rawPlanId || !isUuid(rawPlanId)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing or invalid required field: 'planId' (valid UUID required)",
        } as CreateSubscriptionResponse),
      };
    }

    const customerUuid = await resolveCustomerUuid(rawCustomerId);
    if (!customerUuid) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer not found for identifier: '${rawCustomerId}'`,
        } as CreateSubscriptionResponse),
      };
    }

    // Verify plan exists
    const planCheck = await query<{ id: string }>(
      "SELECT id::text FROM public.plans WHERE id = $1 LIMIT 1;",
      [rawPlanId]
    );
    if (planCheck.rows.length === 0) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Plan not found for ID: '${rawPlanId}'`,
        } as CreateSubscriptionResponse),
      };
    }

    const status = payload.status || "active";
    const startDate = payload.startDate || payload.start_date || null;
    const endDate = payload.endDate || payload.end_date || null;
    const amount = typeof payload.amount === "number" ? payload.amount : null;
    const currency = payload.currency || "INR";
    const billingInterval = payload.billingInterval || payload.billing_interval || "monthly";

    const insertSql = `
      INSERT INTO public.subscriptions (
        id, customer_id, plan_id, status, start_date, end_date,
        amount, currency, billing_interval, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4, $5,
        $6, $7, $8, NOW(), NOW()
      )
      RETURNING 
        id::text, customer_id::text, plan_id::text, status, start_date,
        end_date, amount::numeric, currency, billing_interval,
        created_at, updated_at;
    `;

    const result = await query<SubscriptionRecord>(insertSql, [
      customerUuid, rawPlanId, status, startDate, endDate,
      amount, currency, billingInterval
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        subscription: result.rows[0],
      } as CreateSubscriptionResponse),
    };
  } catch (error: any) {
    console.error("Error executing createSubscriptionHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create subscription",
      } as CreateSubscriptionResponse),
    };
  }
}
