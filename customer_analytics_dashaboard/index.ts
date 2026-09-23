import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "./types";
import { getNotesHandler } from "./notes/getNotes";
import { createNoteHandler } from "./notes/createNote";
import { getMeetingsHandler } from "./meetings/getMeetings";
import { createMeetingHandler } from "./meetings/createMeeting";
import { getContactsHandler } from "./contacts/getContacts";
import { getTicketsHandler } from "./tickets/getTickets";
import { getSubscriptionsHandler } from "./subscriptions/getSubscriptions";
import { createSubscriptionHandler } from "./subscriptions/createSubscription";
import { getCustomerOfferingsHandler } from "./customerOfferings/getCustomerOfferings";
import { createCustomerOfferingHandler } from "./customerOfferings/createCustomerOffering";
export * from "./types";
export * from "./db";
export { getNotesHandler } from "./notes/getNotes";
export { createNoteHandler } from "./notes/createNote";
export { getMeetingsHandler } from "./meetings/getMeetings";
export { createMeetingHandler } from "./meetings/createMeeting";
export { getContactsHandler } from "./contacts/getContacts";
export { getTicketsHandler } from "./tickets/getTickets";
export { getSubscriptionsHandler } from "./subscriptions/getSubscriptions";
export { createSubscriptionHandler } from "./subscriptions/createSubscription";
export { getCustomerOfferingsHandler } from "./customerOfferings/getCustomerOfferings";
export { createCustomerOfferingHandler } from "./customerOfferings/createCustomerOffering";

const CORS_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Amz-Date,X-Api-Key",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

/**
 * Unified Lambda entrypoint router.
 * Dispatches API Gateway requests based on HTTP method and path,
 * or allows calling individual handlers directly.
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
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

  // 1. Notes API
  if (method === "GET" && (rawPath.endsWith("/notes") || rawPath.includes("/notes/"))) {
    return getNotesHandler(event);
  }
  if (method === "POST" && rawPath.endsWith("/notes")) {
    return createNoteHandler(event);
  }

  // 2. Customer Details API
  // if (
  //   method === "GET" &&
  //   (rawPath.includes("/customer-details") || rawPath.includes("/customer_details"))
  // ) {
  //   if (
  //     event.pathParameters?.id ||
  //     event.pathParameters?.customerId ||
  //     event.queryStringParameters?.id ||
  //     event.queryStringParameters?.customerId ||
  //     event.queryStringParameters?.clientUserId
  //   ) {
  //     return getCustomerDetailsHandler(event);
  //   }
  //   return listCustomerDetailsHandler(event);
  // }

  // 3. Meetings API
  if (method === "GET" && (rawPath.endsWith("/meetings") || rawPath.includes("/meetings/"))) {
    return getMeetingsHandler(event);
  }
  if (method === "POST" && rawPath.endsWith("/meetings")) {
    return createMeetingHandler(event);
  }

  // 4. Contacts API
  if (method === "GET" && (rawPath.endsWith("/contacts") || rawPath.includes("/contacts/"))) {
    return getContactsHandler(event);
  }


  // 5. Deals API
  // if (method === "GET" && (rawPath.endsWith("/deals") || rawPath.includes("/deals/"))) {
  //   return getDealsHandler(event);
  // }
  // if (method === "POST" && rawPath.endsWith("/deals")) {
  //   return createDealHandler(event);
  // }

  // 6. Tickets API
  if (method === "GET" && (rawPath.endsWith("/tickets") || rawPath.includes("/tickets/"))) {
    return getTicketsHandler(event);
  }
  // if (method === "POST" && rawPath.endsWith("/tickets")) {
  //   return createTicketHandler(event);
  // }

  // 7. Team Members API
  // if (
  //   method === "GET" &&
  //   (rawPath.endsWith("/team-members") ||
  //     rawPath.includes("/team-members/") ||
  //     rawPath.endsWith("/team_members") ||
  //     rawPath.includes("/team_members/"))
  // ) {
  //   return getTeamMembersHandler(event);
  // }
  // if (
  //   method === "POST" &&
  //   (rawPath.endsWith("/team-members") || rawPath.endsWith("/team_members"))
  // ) {
  //   return createTeamMemberHandler(event);
  // }

  // 8. Products API
  // if (method === "GET" && (rawPath.endsWith("/products") || rawPath.includes("/products/"))) {
  //   return getProductsHandler(event);
  // }
  // if (method === "POST" && rawPath.endsWith("/products")) {
  //   return createProductHandler(event);
  // }

  // 9. Subscriptions API
  if (
    method === "GET" &&
    (rawPath.endsWith("/subscriptions") || rawPath.includes("/subscriptions/"))
  ) {
    return getSubscriptionsHandler(event);
  }
  if (method === "POST" && rawPath.endsWith("/subscriptions")) {
    return createSubscriptionHandler(event);
  }

  // 10. Customer Offerings API
  if (
    method === "GET" &&
    (rawPath.endsWith("/customer-offerings") ||
      rawPath.includes("/customer-offerings/") ||
      rawPath.endsWith("/customer_offerings") ||
      rawPath.includes("/customer_offerings/") ||
      rawPath.endsWith("/offerings") ||
      rawPath.includes("/offerings/"))
  ) {
    return getCustomerOfferingsHandler(event);
  }
  if (
    method === "POST" &&
    (rawPath.endsWith("/customer-offerings") ||
      rawPath.endsWith("/customer_offerings") ||
      rawPath.endsWith("/offerings"))
  ) {
    return createCustomerOfferingHandler(event);
  }

  // 11. Invoices API
  // if (method === "GET" && (rawPath.endsWith("/invoices") || rawPath.includes("/invoices/"))) {
  //   return getInvoicesHandler(event);
  // }
  // if (method === "POST" && rawPath.endsWith("/invoices")) {
  //   return createInvoiceHandler(event);
  // }

  // 12. Usage Metrics API
  // if (
  //   method === "GET" &&
  //   (rawPath.endsWith("/usage-metrics") ||
  //     rawPath.includes("/usage-metrics/") ||
  //     rawPath.endsWith("/usage_metrics") ||
  //     rawPath.includes("/usage_metrics/"))
  // ) {
  //   return getUsageMetricsHandler(event);
  // }
  // if (
  //   method === "POST" &&
  //   (rawPath.endsWith("/usage-metrics") || rawPath.endsWith("/usage_metrics"))
  // ) {
  //   return createUsageMetricHandler(event);
  // }

  // 13. Activities API
  // if (
  //   method === "GET" &&
  //   (rawPath.endsWith("/activities") || rawPath.includes("/activities/"))
  // ) {
  //   return getActivitiesHandler(event);
  // }


  // Fallback 404
  return {
    statusCode: 404,
    headers: CORS_HEADERS,
    body: JSON.stringify({
      success: false,
      error: `Route not found for method ${method} at path ${rawPath}`,
    }),
  };
}
