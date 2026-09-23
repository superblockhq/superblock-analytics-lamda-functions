import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  UsageMetricRecord,
  CreateUsageMetricInput,
  CreateUsageMetricResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

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

export async function createUsageMetricHandler(
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
        } as CreateUsageMetricResponse),
      };
    }

    let payload: CreateUsageMetricInput;
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
        } as CreateUsageMetricResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.customer_id ||
      ""
    ).trim();

    const metricName = (payload.metricName || payload.metric_name || "").trim();

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateUsageMetricResponse),
      };
    }

    if (!metricName) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'metricName'",
        } as CreateUsageMetricResponse),
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
        } as CreateUsageMetricResponse),
      };
    }

    const metricValue = typeof payload.metricValue === "number" ? payload.metricValue : (typeof payload.metric_value === "number" ? payload.metric_value : null);
    const metricUnit = payload.metricUnit || payload.metric_unit || "count";
    const rawRecordedAt = payload.recordedAt || payload.recorded_at || null;
    let recordedAt = null;
    if (rawRecordedAt) {
      const parsed = new Date(rawRecordedAt);
      if (!isNaN(parsed.getTime())) {
        recordedAt = parsed.toISOString();
      }
    }

    const insertSql = `
      INSERT INTO public.usage_metrics (
        id, customer_id, metric_name, metric_value, metric_unit,
        recorded_at, created_at
      ) VALUES (
        gen_random_uuid(), $1, $2, $3, $4,
        COALESCE($5::timestamptz, NOW()), NOW()
      )
      RETURNING 
        id::text, customer_id::text, metric_name, metric_value::numeric,
        metric_unit, recorded_at, created_at;
    `;

    const result = await query<UsageMetricRecord>(insertSql, [
      customerUuid, metricName, metricValue, metricUnit, recordedAt
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        usageMetric: result.rows[0],
      } as CreateUsageMetricResponse),
    };
  } catch (error: any) {
    console.error("Error executing createUsageMetricHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create usage metric",
      } as CreateUsageMetricResponse),
    };
  }
}
