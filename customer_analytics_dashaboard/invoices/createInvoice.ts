import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  InvoiceRecord,
} from "../types";

export interface CreateInvoiceInput {
  customerId: string;
  invoiceNumber?: string;
  amount: number;
  currency?: string;
  status?: string;
  issueDate?: string;
  dueDate?: string;
  description?: string;
}

export interface CreateInvoiceResponse {
  success: boolean;
  invoice?: InvoiceRecord;
  error?: string;
}

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function resolveCustomerUuid(identifier: string): Promise<string | null> {
  const sql = `
    SELECT c.id::text 
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
    ORDER BY (c.id::text = $1) DESC, (c.client_user_id = u.user_name) DESC
    LIMIT 1;
  `;
  const res = await query<{ id: string }>(sql, [identifier]);
  return res.rows.length > 0 ? res.rows[0].id : null;
}

/**
 * Lambda handler to INSERT a new invoice into public.invoices.
 */
export async function createInvoiceHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    let payload: CreateInvoiceInput;

    if (!event.body) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Request body cannot be empty",
        } as CreateInvoiceResponse),
      };
    }

    try {
      payload = typeof event.body === "string" ? JSON.parse(event.body) : event.body;
    } catch {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Malformed JSON payload",
        } as CreateInvoiceResponse),
      };
    }

    const rawCustomerId = (payload.customerId || (payload as any).customer_id || "").trim();
    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateInvoiceResponse),
      };
    }

    const resolvedCustomerId = await resolveCustomerUuid(rawCustomerId);
    if (!resolvedCustomerId) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer '${rawCustomerId}' not found in database`,
        } as CreateInvoiceResponse),
      };
    }
    const customerId = resolvedCustomerId;

    const amount = Number(payload.amount);
    if (isNaN(amount) || amount < 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Amount must be a non-negative number",
        } as CreateInvoiceResponse),
      };
    }

    const invoiceNumber = (payload.invoiceNumber || (payload as any).invoice_number || "").trim() ||
      `INV-${Date.now().toString(36).toUpperCase()}`;

    const currency = (payload.currency || "INR").trim().toUpperCase();
    const status = (payload.status || "Sent").trim();
    const description = (payload.description || "Platform & Software Services").trim();
    const issueDate = payload.issueDate || (payload as any).issue_date || new Date().toISOString().split("T")[0];
    const dueDate = payload.dueDate || (payload as any).due_date || new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];

    const insertSql = `
      INSERT INTO public.invoices (
        customer_id,
        invoice_number,
        status,
        amount,
        currency,
        issue_date,
        due_date,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING 
        id::text,
        customer_id::text,
        invoice_number,
        status,
        amount::numeric,
        currency,
        issue_date,
        due_date,
        paid_date,
        description,
        created_at,
        updated_at;
    `;

    const result = await query<InvoiceRecord>(insertSql, [
      customerId,
      invoiceNumber,
      status,
      amount,
      currency,
      issueDate,
      dueDate,
      description,
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        invoice: result.rows[0],
      } as CreateInvoiceResponse),
    };
  } catch (error: any) {
    console.error("Error executing createInvoiceHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create invoice",
      } as CreateInvoiceResponse),
    };
  }
}
