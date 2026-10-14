import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "./types";
import { getNotesHandler } from "./notes/getNotes";
import { createNoteHandler } from "./notes/createNote";
import { deleteNoteHandler } from "./notes/deleteNote";
import { updateNoteHandler } from "./notes/updateNote";
import {
  getCustomerDetailsHandler,
  listCustomerDetailsHandler,
} from "./customerDetails/getCustomerDetails";
import { getMeetingsHandler } from "./meetings/getMeetings";
import { createMeetingHandler } from "./meetings/createMeeting";
import { deleteMeetingHandler } from "./meetings/deleteMeeting";
import { updateMeetingHandler } from "./meetings/updateMeeting";
import { getActivitiesHandler } from "./activities/getActivities";
import { getCredentialsHandler } from "./credentials/getCredentials";
import { getMessagesHandler } from "./messages/getMessages";
import { getBroadcastsHandler } from "./broadcasts/getBroadcasts";

export * from "./types";
export * from "./db";
export { getCredentialsHandler } from "./credentials/getCredentials";
export { getNotesHandler } from "./notes/getNotes";
export { createNoteHandler } from "./notes/createNote";
export { deleteNoteHandler } from "./notes/deleteNote";
export { updateNoteHandler } from "./notes/updateNote";
export {
  getCustomerDetailsHandler,
  listCustomerDetailsHandler,
} from "./customerDetails/getCustomerDetails";
export { getMeetingsHandler } from "./meetings/getMeetings";
export { createMeetingHandler } from "./meetings/createMeeting";
export { deleteMeetingHandler } from "./meetings/deleteMeeting";
export { updateMeetingHandler } from "./meetings/updateMeeting";
export { getActivitiesHandler } from "./activities/getActivities";
export { getMessagesHandler } from "./messages/getMessages";
export { getBroadcastsHandler } from "./broadcasts/getBroadcasts";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token",
  "Access-Control-Allow-Methods": "DELETE,GET,HEAD,OPTIONS,PATCH,POST,PUT",
};

/**
 * Unified Lambda entrypoint router.
 * Dispatches API Gateway requests based on HTTP method and path,
 * or allows calling individual handlers directly.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const method = (
      event.httpMethod ||
      event.requestContext?.http?.method ||
      "GET"
    ).toUpperCase();
    const rawPath = (
      event.path ||
      event.rawPath ||
      event.requestContext?.http?.path ||
      "/"
    ).toLowerCase();

    // Handle CORS Preflight
    if (method === "OPTIONS") {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({ message: "OK" }),
      };
    }

    // Extract query parameter action / resource
    const action = (
      event.queryStringParameters?.action ||
      event.queryStringParameters?.resource ||
      event.queryStringParameters?.path ||
      ""
    ).toLowerCase().replace(/^\/+/, "");

    // 0. Root Health Check / Introspection Route
    const isRootRequest =
      rawPath === "/" ||
      rawPath === "" ||
      rawPath.endsWith("/customeranalyticsdashaboard") ||
      rawPath.endsWith("/customeranalyticsdashboard");

    if (method === "GET" && isRootRequest && !action) {
      return {
        statusCode: 200,
        headers: CORS_HEADERS,
        body: JSON.stringify({
          status: "healthy",
          message: "Superblock Analytics Dashboard API is live",
          timestamp: new Date().toISOString(),
          version: "1.0.0",
          supportedEntities: [
            "notes",
            "meetings",
            "customerDetails",
            "activities",
            "credentials",
            "messages",
            "broadcasts",
          ],
        }),
      };
    }

    // 1. Notes API
    if (
      (method === "GET" && (rawPath.endsWith("/notes") || rawPath.includes("/notes/"))) ||
      (method === "GET" && (action === "notes" || action === "get_notes"))
    ) {
      return await getNotesHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/notes")) ||
      (method === "POST" && (
        action === "notes" ||
        action === "create_note" ||
        rawPath.endsWith("/customeranalytics") ||
        rawPath.endsWith("/customer-analytics")
      ))
    ) {
      return await createNoteHandler(event);
    }
    if (
      (method === "DELETE" && (rawPath.includes("/notes/") || rawPath.endsWith("/notes"))) ||
      (method === "DELETE" && (action === "delete_note" || action === "notes"))
    ) {
      return await deleteNoteHandler(event);
    }
    if (
      ((method === "PUT" || method === "PATCH") && (rawPath.includes("/notes/") || rawPath.endsWith("/notes"))) ||
      ((method === "PUT" || method === "PATCH") && (action === "update_note" || action === "notes"))
    ) {
      return await updateNoteHandler(event);
    }

    // 2. Customer Details API
    if (
      (method === "GET" && (rawPath.includes("/customer-details") || rawPath.includes("/customer_details"))) ||
      (method === "GET" && (action === "customer_details" || action === "customerdetails" || action === "customer-details"))
    ) {
      if (
        event.pathParameters?.id ||
        event.pathParameters?.customerId ||
        event.queryStringParameters?.id ||
        event.queryStringParameters?.customerId ||
        event.queryStringParameters?.clientUserId
      ) {
        return await getCustomerDetailsHandler(event);
      }
      return await listCustomerDetailsHandler(event);
    }

    // 3. Meetings API
    if (
      (method === "GET" && (rawPath.endsWith("/meetings") || rawPath.includes("/meetings/"))) ||
      (method === "GET" && (action === "meetings" || action === "get_meetings"))
    ) {
      return await getMeetingsHandler(event);
    }
    if (
      (method === "POST" && rawPath.endsWith("/meetings")) ||
      (method === "POST" && (action === "meetings" || action === "create_meeting"))
    ) {
      return await createMeetingHandler(event);
    }
    if (
      (method === "DELETE" && (rawPath.includes("/meetings/") || rawPath.endsWith("/meetings"))) ||
      (method === "DELETE" && (action === "delete_meeting" || action === "meetings"))
    ) {
      return await deleteMeetingHandler(event);
    }
    if (
      ((method === "PUT" || method === "PATCH") && (rawPath.includes("/meetings/") || rawPath.endsWith("/meetings"))) ||
      ((method === "PUT" || method === "PATCH") && (action === "update_meeting" || action === "meetings"))
    ) {
      return await updateMeetingHandler(event);
    }


    // 4. Activities API
    if (
      (method === "GET" &&
        (rawPath.endsWith("/activities") || rawPath.includes("/activities/"))) ||
      (method === "GET" && (action === "activities" || action === "get_activities"))
    ) {
      return await getActivitiesHandler(event);
    }

    // 14. Credentials API
    if (
      (method === "GET" &&
        (rawPath.endsWith("/credentials") || rawPath.includes("/credentials/"))) ||
      (method === "GET" && (action === "credentials" || action === "get_credentials"))
    ) {
      return await getCredentialsHandler(event);
    }

    // 15. Messages API (AWS DynamoDB Messages table)
    if (
      (method === "GET" &&
        (rawPath.endsWith("/messages") ||
          rawPath.includes("/messages/") ||
          rawPath.endsWith("/usage-metrics/messages") ||
          rawPath.includes("/usage-metrics/messages/"))) ||
      (method === "GET" && (action === "messages" || action === "get_messages" || action === "dynamo_messages"))
    ) {
      return await getMessagesHandler(event);
    }

    // 16. Broadcasts API (PostgreSQL public.broadcasts)
    if (
      (method === "GET" &&
        (rawPath.endsWith("/broadcasts") ||
          rawPath.includes("/broadcasts/") ||
          rawPath.endsWith("/broadcast-usage") ||
          rawPath.endsWith("/broadcasts-usage") ||
          rawPath.endsWith("/usage-metrics/broadcasts") ||
          rawPath.includes("/usage-metrics/broadcasts/"))) ||
      (method === "GET" && (action === "broadcasts" || action === "get_broadcasts" || action === "broadcast_usage"))
    ) {
      return await getBroadcastsHandler(event);
    }

    // Fallback 404
    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: `Route not found for method ${method} at path ${rawPath}${action ? ` with action=${action}` : ""}`,
      }),
    };
  } catch (error: any) {
    console.error("Top-level unhandled Lambda error:", error);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({
        success: false,
        error: error?.message || "Internal server error occurred",
        stack: process.env.NODE_ENV === "development" ? error?.stack : undefined,
      }),
    };
  }
}
