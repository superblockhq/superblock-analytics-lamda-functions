import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  TicketRecord,
  GetTicketsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getTicketsHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const params = event.queryStringParameters || {};
    const pathParams = event.pathParameters || {};
    const customerId = (
      params.customerId ||
      params.customer_id ||
      params.userId ||
      params.user_id ||
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
          tickets: [],
          error: "Missing required parameter: 'customerId' (UUID or user_id)",
        } as GetTicketsResponse),
      };
    }

    const sql = `
      SELECT 
        id,
        ticket_id,
        client_id,
        user_id,
        user_name,
        user_email,
        user_phone,
        title,
        subject,
        description,
        category,
        priority,
        status,
        assigned_to,
        created_at,
        updated_at
      FROM public.tickets
      WHERE LOWER(user_id) = LOWER($1)
         OR LOWER(client_id) = LOWER($1)
         OR user_id IN (
           SELECT cd.client_user_id 
           FROM public.customers_details cd 
           WHERE cd.id::text = $1
         )
      ORDER BY created_at DESC;
    `;

    const result = await query<TicketRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        tickets: result.rows,
      } as GetTicketsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getTicketsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        tickets: [],
        error: error.message || "Failed to retrieve tickets",
      } as GetTicketsResponse),
    };
  }
}
