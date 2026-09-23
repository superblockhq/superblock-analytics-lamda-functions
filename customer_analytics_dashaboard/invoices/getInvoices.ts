import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  InvoiceRecord,
  GetInvoicesResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

export async function getInvoicesHandler(
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
          invoices: [],
          error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
        } as GetInvoicesResponse),
      };
    }

    const sql = `
      SELECT 
        i.id::text,
        i.customer_id::text,
        i.invoice_number,
        i.status,
        i.amount::numeric,
        i.currency,
        i.issue_date,
        i.due_date,
        i.paid_date,
        i.description,
        i.created_at,
        i.updated_at
      FROM public.invoices i
      WHERE i.customer_id::text = $1
         OR i.customer_id IN (
           SELECT c.id 
           FROM public.customers_details c
           LEFT JOIN public.users u ON (
             LOWER(c.client_user_id) = LOWER(u.user_name) 
             OR LOWER(c.client_user_id) = LOWER(u.email) 
             OR LOWER(c.client_user_id) = LOWER(u.user_email)
             OR LOWER(c.client_user_id) = LOWER(u.user_id::text)
           )
           WHERE c.id::text = $1 
              OR LOWER(c.client_user_id) = LOWER($1)
              OR u.user_id::text = $1
              OR LOWER(u.user_name) = LOWER($1)
              OR LOWER(u.email) = LOWER($1)
              OR LOWER(u.user_email) = LOWER($1)
         )
      ORDER BY i.created_at DESC NULLS LAST;
    `;

    const result = await query<InvoiceRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        invoices: result.rows,
      } as GetInvoicesResponse),
    };
  } catch (error: any) {
    console.error("Error executing getInvoicesHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        invoices: [],
        error: error.message || "Failed to retrieve invoices",
      } as GetInvoicesResponse),
    };
  }
}
