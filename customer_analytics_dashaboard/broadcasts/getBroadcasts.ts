import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  BroadcastRecord,
  BroadcastStatusCount,
  BroadcastMediaTypeCount,
  BroadcastDailyCount,
  BroadcastUsageMetrics,
  GetBroadcastsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/**
 * Real Broadcasts Lambda handler using the PostgreSQL database ('superblockhq').
 *
 * Source table: public.broadcasts
 * Security: graph_api_token is strictly excluded from all queries.
 * Safety: Read-only queries with parameterized values.
 *
 * Requirements:
 * - Accept customer identifier and filter on public.broadcasts (user_id, user_name, or related users/customers_details).
 * - Return real broadcast count, total_recipients, status breakdown, media type breakdown, and time series.
 */
export async function getBroadcastsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const queriedAt = new Date().toISOString();

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ message: "OK" }),
    };
  }

  let customerId = "";
  let limit = 50;

  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};

    // 1. Resolve customer identifier
    customerId = (
      params.customerId ||
      params.customer_id ||
      params.userId ||
      params.user_id ||
      params.clientUserId ||
      params.client_user_id ||
      params.userName ||
      params.user_name ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    // If request body contains customerId (for POST invocations)
    if (!customerId && event.body) {
      try {
        const parsedBody = JSON.parse(event.body);
        customerId = (
          parsedBody.customerId ||
          parsedBody.customer_id ||
          parsedBody.userId ||
          parsedBody.user_id ||
          parsedBody.userName ||
          parsedBody.user_name ||
          ""
        ).trim();
      } catch {
        // Body is not JSON
      }
    }

    if (params.limit) {
      const parsedLimit = parseInt(params.limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = Math.min(parsedLimit, 200);
      }
    }

    const isPlatform = !customerId;

    // 2. Build parameterized WHERE clause
    let whereClause = "";
    let queryParams: any[] = [];

    if (!isPlatform) {
      whereClause = `
        WHERE (
          b.user_id::text = $1
          OR (b.user_name IS NOT NULL AND (b.user_name = $1 OR LOWER(b.user_name) = LOWER($1)))
          OR b.user_id IN (
            SELECT u.user_id FROM public.users u
            LEFT JOIN public.customers_details cd ON (
              LOWER(cd.client_user_id) = LOWER(u.user_name)
              OR LOWER(cd.client_user_id) = LOWER(u.email)
              OR LOWER(cd.client_user_id) = LOWER(u.user_email)
              OR LOWER(cd.client_user_id) = LOWER(u.user_id::text)
            )
            WHERE u.user_id::text = $1
               OR LOWER(u.user_name) = LOWER($1)
               OR cd.id::text = $1
               OR LOWER(cd.client_user_id) = LOWER($1)
          )
        )
      `;
      queryParams = [customerId];
    }

    // 3. Query Overview & Totals
    const totalsSql = `
      SELECT
        COUNT(*)::int AS total_broadcasts,
        COALESCE(SUM(b.total_recipients::bigint), 0)::bigint AS total_recipients,
        ROUND(AVG(b.total_recipients::numeric), 1) AS avg_recipients,
        MAX(b.total_recipients::bigint) AS max_recipients,
        MIN(b.total_recipients::bigint) AS min_recipients,
        MIN(COALESCE(b.sent_at, b.created_at))::text AS earliest_broadcast_at,
        MAX(COALESCE(b.sent_at, b.created_at))::text AS latest_broadcast_at,
        COUNT(*) FILTER (WHERE b.has_flow = true)::int AS has_flow_count
      FROM public.broadcasts b
      ${whereClause};
    `;

    const totalsResult = await query<{
      total_broadcasts: number;
      total_recipients: string | number;
      avg_recipients: string | number | null;
      max_recipients: string | number | null;
      min_recipients: string | number | null;
      earliest_broadcast_at: string | null;
      latest_broadcast_at: string | null;
      has_flow_count: number;
    }>(totalsSql, queryParams);

    const totalsRow = totalsResult.rows[0] || {
      total_broadcasts: 0,
      total_recipients: 0,
      avg_recipients: null,
      max_recipients: null,
      min_recipients: null,
      earliest_broadcast_at: null,
      latest_broadcast_at: null,
      has_flow_count: 0,
    };

    const totalBroadcasts = Number(totalsRow.total_broadcasts) || 0;
    const totalRecipients = Number(totalsRow.total_recipients) || 0;
    const avgRecipients = totalsRow.avg_recipients !== null ? Number(totalsRow.avg_recipients) : null;
    const maxRecipients = totalsRow.max_recipients !== null ? Number(totalsRow.max_recipients) : null;
    const minRecipients = totalsRow.min_recipients !== null ? Number(totalsRow.min_recipients) : null;
    const hasFlowCount = Number(totalsRow.has_flow_count) || 0;
    const earliestBroadcastAt = totalsRow.earliest_broadcast_at;
    const latestBroadcastAt = totalsRow.latest_broadcast_at;

    // 4. Query Status Breakdown
    const statusSql = `
      SELECT
        COALESCE(b.status, 'UNKNOWN') AS status,
        COUNT(*)::int AS count,
        COALESCE(SUM(b.total_recipients::bigint), 0)::bigint AS recipients
      FROM public.broadcasts b
      ${whereClause}
      GROUP BY b.status
      ORDER BY count DESC;
    `;

    const statusResult = await query<{
      status: string;
      count: number;
      recipients: string | number;
    }>(statusSql, queryParams);

    const statusBreakdown: Record<string, number> = {};
    const statusDetails: BroadcastStatusCount[] = statusResult.rows.map((row: { status: string; count: number; recipients: string | number }) => {
      const c = Number(row.count) || 0;
      const r = Number(row.recipients) || 0;
      statusBreakdown[row.status] = c;
      return {
        status: row.status,
        count: c,
        recipients: r,
      };
    });

    // 5. Query Media Type Breakdown
    const mediaSql = `
      SELECT
        COALESCE(b.media_type, 'text') AS media_type,
        COUNT(*)::int AS count,
        COALESCE(SUM(b.total_recipients::bigint), 0)::bigint AS recipients
      FROM public.broadcasts b
      ${whereClause}
      GROUP BY b.media_type
      ORDER BY count DESC;
    `;

    const mediaResult = await query<{
      media_type: string;
      count: number;
      recipients: string | number;
    }>(mediaSql, queryParams);

    const mediaTypeBreakdown: Record<string, number> = {};
    const mediaTypeDetails: BroadcastMediaTypeCount[] = mediaResult.rows.map((row: { media_type: string; count: number; recipients: string | number }) => {
      const c = Number(row.count) || 0;
      const r = Number(row.recipients) || 0;
      mediaTypeBreakdown[row.media_type] = c;
      return {
        mediaType: row.media_type,
        count: c,
        recipients: r,
      };
    });

    // 6. Query Daily Time-Series Breakdown
    const dailySql = `
      SELECT
        DATE(COALESCE(b.sent_at, b.created_at))::text AS date,
        COUNT(*)::int AS broadcasts,
        COALESCE(SUM(b.total_recipients::bigint), 0)::bigint AS recipients
      FROM public.broadcasts b
      ${whereClause}
      GROUP BY DATE(COALESCE(b.sent_at, b.created_at))
      ORDER BY date ASC;
    `;

    const dailyResult = await query<{
      date: string;
      broadcasts: number;
      recipients: string | number;
    }>(dailySql, queryParams);

    const dailyBreakdown: BroadcastDailyCount[] = dailyResult.rows
      .filter((row: { date: string; broadcasts: number; recipients: string | number }) => row.date !== null && row.date !== "")
      .map((row: { date: string; broadcasts: number; recipients: string | number }) => ({
        date: row.date,
        broadcasts: Number(row.broadcasts) || 0,
        recipients: Number(row.recipients) || 0,
      }));

    // 7. Query Recent Broadcasts (Strictly omitting sensitive graph_api_token and payload)
    const recentLimitParamIndex = queryParams.length + 1;
    const recentParams = [...queryParams, limit];
    const recentSql = `
      SELECT
        b.id::text,
        b.user_id::text,
        b.user_name,
        b.campaign_name,
        b.template_name,
        b.message,
        b.message_txt,
        b.language,
        b.media_type,
        b.media_url,
        b.uploaded_file_url,
        b.media_handle,
        b.has_flow,
        b.business_phone_number_id,
        b.status,
        b.total_recipients::int,
        b.scheduled_at::text,
        b.sent_at::text,
        b.created_at::text,
        b.completed_at::text,
        b.updated_at::text
      FROM public.broadcasts b
      ${whereClause}
      ORDER BY COALESCE(b.sent_at, b.created_at) DESC NULLS LAST
      LIMIT $${recentLimitParamIndex};
    `;

    const recentResult = await query<BroadcastRecord>(recentSql, recentParams);
    const recentBroadcasts: BroadcastRecord[] = recentResult.rows.map((r: BroadcastRecord) => ({
      ...r,
      total_recipients: r.total_recipients !== null ? Number(r.total_recipients) : null,
    }));

    // 8. Assemble response
    const metrics: BroadcastUsageMetrics = {
      totalBroadcasts,
      totalRecipients,
      avgRecipients,
      maxRecipients,
      minRecipients,
      hasFlowCount,
      statusBreakdown,
      statusDetails,
      mediaTypeBreakdown,
      mediaTypeDetails,
      dailyBreakdown,
      earliestBroadcastAt,
      latestBroadcastAt,
      recentBroadcasts,
    };

    const response: GetBroadcastsResponse = {
      success: true,
      source: "postgresql_broadcasts",
      table: "public.broadcasts",
      scope: isPlatform ? "platform" : "customer",
      customerId: customerId || "",
      count: totalBroadcasts,
      totalBroadcasts,
      totalRecipients,
      metrics,
      queriedAt,
    };

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify(response),
    };
  } catch (error: any) {
    console.error("Error executing getBroadcastsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        source: "postgresql_broadcasts",
        table: "public.broadcasts",
        scope: customerId ? "customer" : "platform",
        customerId: customerId || "",
        count: 0,
        totalBroadcasts: 0,
        totalRecipients: 0,
        error: error?.message || "Failed to query operational database public.broadcasts",
        queriedAt,
      } as GetBroadcastsResponse),
    };
  }
}
