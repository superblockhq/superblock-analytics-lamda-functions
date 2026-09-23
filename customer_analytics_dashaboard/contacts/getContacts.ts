import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  ContactRecord,
  GetContactsResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,OPTIONS",
};

/**
 * Lambda handler to GET contacts for a specific customer.
 * 
 * Query parameters:
 * - customerId / clientUserId / client_user_id
 */
export async function getContactsHandler(
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
          contacts: [],
          error: "Missing required parameter: 'customerId' (UUID or client_user_id)",
        } as GetContactsResponse),
      };
    }

    const sql = `
      SELECT 
        id::text,
        client_user_id,
        contact_id::text,
        contact_name,
        phone,
        selected,
        created_at,
        timestamp,
        email,
        whatsapp_opt_in,
        membership_tier,
        tags,
        notes,
        updated_at,
        country_code
      FROM public.contacts
      WHERE LOWER(client_user_id) = LOWER($1)
         OR client_user_id IN (
           SELECT cd.client_user_id 
           FROM public.customers_details cd 
           WHERE cd.id::text = $1
         )
      ORDER BY created_at DESC;
    `;

    const result = await query<ContactRecord>(sql, [customerId]);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        count: result.rows.length,
        customerId,
        contacts: result.rows,
      } as GetContactsResponse),
    };
  } catch (error: any) {
    console.error("Error executing getContactsHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        count: 0,
        customerId: "",
        contacts: [],
        error: error.message || "Failed to retrieve contacts",
      } as GetContactsResponse),
    };
  }
}
