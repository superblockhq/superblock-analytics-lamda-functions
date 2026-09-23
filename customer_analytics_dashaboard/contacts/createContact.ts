import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  ContactRecord,
  CreateContactInput,
  CreateContactResponse,
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

async function resolveClientUserId(identifier: string): Promise<string | null> {
  const sql = `
    SELECT client_user_id 
    FROM public.customers_details 
    WHERE id::text = $1 OR LOWER(client_user_id) = LOWER($1)
    LIMIT 1;
  `;
  const res = await query<{ client_user_id: string }>(sql, [identifier]);
  return res.rows.length > 0 ? res.rows[0].client_user_id : null;
}

export async function createContactHandler(
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
        } as CreateContactResponse),
      };
    }

    let payload: CreateContactInput;
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
        } as CreateContactResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.clientUserId ||
      payload.client_user_id ||
      ""
    ).trim();
    const contactName = (
      payload.contactName ||
      payload.contact_name ||
      ""
    ).trim();
    const phone = (payload.phone || "").trim();
    const email = payload.email?.trim() || null;
    const countryCode = (payload.countryCode || payload.country_code || "91").trim();
    const whatsappOptIn = payload.whatsappOptIn ?? payload.whatsapp_opt_in ?? true;
    const membershipTier = payload.membershipTier || payload.membership_tier || null;
    const tags = payload.tags || null;
    const notes = payload.notes || null;
    const selected = payload.selected || false;
    const rawContactId = payload.contactId || payload.contact_id || null;
    const contactId = rawContactId && isUuid(rawContactId) ? rawContactId : null;

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateContactResponse),
      };
    }

    if (!contactName) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'contactName'",
        } as CreateContactResponse),
      };
    }

    if (!phone) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'phone'",
        } as CreateContactResponse),
      };
    }

    const clientUserId = await resolveClientUserId(rawCustomerId);
    if (!clientUserId) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer not found for identifier: '${rawCustomerId}'`,
        } as CreateContactResponse),
      };
    }

    const timestamp = Date.now();

    const insertSql = `
      INSERT INTO public.contacts (
        id,
        client_user_id,
        contact_id,
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
      ) VALUES (
        gen_random_uuid(),
        $1,
        COALESCE($2::uuid, gen_random_uuid()),
        $3,
        $4,
        $5,
        NOW(),
        $6,
        $7,
        $8,
        $9,
        $10,
        $11,
        NOW(),
        $12
      )
      RETURNING 
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
        country_code;
    `;

    const result = await query<ContactRecord>(insertSql, [
      clientUserId,
      contactId,
      contactName,
      phone,
      selected,
      timestamp,
      email,
      whatsappOptIn,
      membershipTier,
      tags,
      notes,
      countryCode,
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        contact: result.rows[0],
      } as CreateContactResponse),
    };
  } catch (error: any) {
    console.error("Error executing createContactHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create contact",
      } as CreateContactResponse),
    };
  }
}
