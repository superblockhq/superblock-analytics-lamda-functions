import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  DealRecord,
  GetDealsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getDealsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const customerId = (
      params.customerId ||
      params.customer_id ||
      params.clientUserId ||
      params.client_user_id ||
      pathParams.customerId ||
      pathParams.id ||
      ""
    ).trim();

    if (!customerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          count: 0,
          customerId: "",
          deals: [],
          error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
        } as GetDealsResponse),
      };
    }

    const sql = `
      SELECT 
        id,
        client_id,
        client_user_id,
        deal_id,
        contact,
        company,
        phone,
        name,
        title,
        value::numeric,
        numeric_value::numeric,
        currency,
        probability::numeric,
        forecast,
        source,
        priority,
        pipeline_id,
        pipeline_name,
        stage,
        stage_id,
        owner,
        notes,
        due_date,
        close_date,
        activity,
        created_by,
        created_at,
        updated_at,
        tags,
        products,
        status,
        owner_id,
        owner_name,
        last_activity_at,
        contact_id,
        original_value::numeric,
        original_currency
      FROM public.deals
      WHERE LOWER(client_user_id) = LOWER($1)
         OR client_id = $1
         OR client_user_id IN (
           SELECT cd.client_user_id 
           FROM public.customers_details cd 
           WHERE cd.id::text = $1
         )
      ORDER BY created_at DESC;
    `;

    const result = await query<DealRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        deals: result.rows,
      } as GetDealsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getDealsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        deals: [],
        error: error.message || "Failed to retrieve deals",
      } as GetDealsResponse),
    };
  }
}
