import crypto from "node:crypto";
import { query } from "../db";
import type {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  TicketRecord,
  CreateTicketInput,
  CreateTicketResponse,
} from "../types";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
};

async function resolveCustomerUser(identifier: string): Promise<{ userId: string; customerName: string | null; email: string | null; phone: string | null } | null> {
  const sql = `
    SELECT client_user_id, customer_name, email, phone 
    FROM public.customers_details 
    WHERE id::text = $1 OR LOWER(client_user_id) = LOWER($1)
    LIMIT 1;
  `;
  const res = await query<{ client_user_id: string; customer_name: string | null; email: string | null; phone: string | null }>(sql, [identifier]);
  if (res.rows.length > 0) {
    return {
      userId: res.rows[0].client_user_id,
      customerName: res.rows[0].customer_name,
      email: res.rows[0].email,
      phone: res.rows[0].phone,
    };
  }
  return null;
}

export async function createTicketHandler(
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
        } as CreateTicketResponse),
      };
    }

    let payload: CreateTicketInput;
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
        } as CreateTicketResponse),
      };
    }

    const rawCustomerId = (
      payload.customerId ||
      payload.userId ||
      payload.user_id ||
      payload.clientId ||
      payload.client_id ||
      ""
    ).trim();

    const title = (payload.title || payload.subject || "").trim();

    if (!rawCustomerId) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'customerId'",
        } as CreateTicketResponse),
      };
    }

    if (!title) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: "Missing required field: 'title' (ticket title or subject cannot be empty)",
        } as CreateTicketResponse),
      };
    }

    const resolved = await resolveCustomerUser(rawCustomerId);
    if (!resolved) {
      return {
        statusCode: 404,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          success: false,
          error: `Customer not found for identifier: '${rawCustomerId}'`,
        } as CreateTicketResponse),
      };
    }

    const ticketUuid = crypto.randomUUID();
    const ticketId = payload.ticketId || payload.ticket_id || `tick_${ticketUuid}`;
    const id = ticketId;
    const clientId = payload.clientId || payload.client_id || resolved.userId;
    const userId = resolved.userId;
    const userName = payload.userName || payload.user_name || resolved.customerName;
    const userEmail = payload.userEmail || payload.user_email || resolved.email;
    const userPhone = payload.userPhone || payload.user_phone || resolved.phone;
    const subject = payload.subject || title;
    const description = payload.description || "";
    const category = payload.category || "General Inquiry";
    const priority = payload.priority || "Low";
    const status = payload.status || "Open";
    const assignedTo = payload.assignedTo || payload.assigned_to || null;

    const insertSql = `
      INSERT INTO public.tickets (
        id, ticket_id, client_id, user_id, user_name, user_email, user_phone,
        title, subject, description, category, priority, status, assigned_to,
        created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12, $13, $14,
        NOW(), NOW()
      )
      RETURNING 
        id, ticket_id, client_id, user_id, user_name, user_email, user_phone,
        title, subject, description, category, priority, status, assigned_to,
        created_at, updated_at;
    `;

    const result = await query<TicketRecord>(insertSql, [
      id, ticketId, clientId, userId, userName, userEmail, userPhone,
      title, subject, description, category, priority, status, assignedTo
    ]);

    return {
      statusCode: 201,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: true,
        ticket: result.rows[0],
      } as CreateTicketResponse),
    };
  } catch (error: any) {
    console.error("Error executing createTicketHandler:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error.message || "Failed to create ticket",
      } as CreateTicketResponse),
    };
  }
}
