import { readFileSync } from "node:fs";
import vm from "node:vm";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const server = read("apps-script/google-calendar/Code.gs");
const html = read("apps-script/google-calendar/Index.html");
const manifest = JSON.parse(read("apps-script/google-calendar/appsscript.json"));

new vm.Script(server, { filename: "Code.gs" });
const scriptTag = html.match(/<script>([\s\S]*?)<\/script>/i);
if (!scriptTag) throw new Error("Apps Script bridge HTML has no inline script.");
const clientScript = scriptTag[1]
  .replace(/<\?!=\s*JSON\.stringify\(bridgeNonce\)\s*\?>/g, '"test-nonce"')
  .replace(/<\?!=\s*JSON\.stringify\(alfredOrigin\)\s*\?>/g, '"https://bm000001.github.io"');
new vm.Script(clientScript, { filename: "Index.html inline script" });

if (manifest.webapp?.executeAs !== "USER_ACCESSING" || manifest.webapp?.access !== "MYSELF") {
  throw new Error("Apps Script must execute as the accessing user and remain private to the script owner.");
}
if (!manifest.oauthScopes?.includes("https://www.googleapis.com/auth/calendar.events") ||
    !manifest.oauthScopes?.includes("https://www.googleapis.com/auth/calendar.calendarlist.readonly")) {
  throw new Error("Required least-privilege Calendar scopes are missing.");
}
if (!manifest.urlFetchWhitelist?.includes("https://www.googleapis.com/") ||
    !manifest.urlFetchWhitelist?.includes("https://openidconnect.googleapis.com/")) {
  throw new Error("Apps Script outbound URL allowlist is incomplete.");
}
if (!manifest.dependencies?.enabledAdvancedServices?.some((service) =>
  service.userSymbol === "Calendar" && service.serviceId === "calendar" && service.version === "v3")) {
  throw new Error("Google Calendar API v3 must be enabled for the Apps Script project.");
}
if (!server.includes('case "session"') || !server.includes('case "deleteEvent"') ||
    !server.includes("ScriptApp.getOAuthToken()") ||
    !server.includes("ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL)")) {
  throw new Error("Apps Script RPC dispatcher is incomplete.");
}
const bridgeClient = read("src/modules/agenda/googleCalendarApi.ts");
const originGuard = bridgeClient.match(/function isTrustedAppsScriptOrigin\(origin: string\): boolean \{[\s\S]*?\n\}/);
if (!originGuard || !originGuard[0].includes('url.hostname === "script.googleusercontent.com"') ||
    !originGuard[0].includes('n-[a-z0-9-]+-script') ||
    originGuard[0].includes('url.hostname.endsWith(".googleusercontent.com")')) {
  throw new Error("Apps Script bridge must trust only the Apps Script Googleusercontent host family.");
}
const originGuardJavaScript = originGuard[0].replace("(origin: string): boolean", "(origin)");
const isTrustedOrigin = vm.runInNewContext("(" + originGuardJavaScript + ")", { URL });
if (!isTrustedOrigin("https://script.google.com") ||
    !isTrustedOrigin("https://script.googleusercontent.com") ||
    !isTrustedOrigin("https://n-abc-script.googleusercontent.com") ||
    isTrustedOrigin("https://evil.googleusercontent.com") ||
    isTrustedOrigin("https://script.google.com.attacker.example") ||
    isTrustedOrigin("https://n-abc-script.googleusercontent.com.attacker.example") ||
    isTrustedOrigin("http://script.google.com")) {
  throw new Error("Apps Script bridge origin allowlist accepted an unexpected host or rejected a valid host.");
}

if (!html.includes("event.source !== openerWindow") || !html.includes("event.origin !== ALFRED_ORIGIN") ||
    !html.includes("window.top") || !html.includes("topWindow.opener") ||
    !html.includes("handledRequestIds.has(data.requestId)") ||
    !html.includes("MAX_REQUESTS_PER_BRIDGE") ||
    !read("src/modules/agenda/googleCalendarApi.ts").includes("function isPopupFrame")) {
  throw new Error("Apps Script message origin/source validation is missing.");
}
if (/Logger\.log|PropertiesService|CacheService|SpreadsheetApp/.test(server) ||
    html.includes("getOAuthToken") || html.includes("Authorization: Bearer")) {
  throw new Error("Apps Script bridge must not log or persist tokens/event payloads or expose OAuth tokens to HTML.");
}
console.log("Google Apps Script manifest, sandbox opener handshake, RPC bridge and JavaScript syntax validated.");


// Runtime contract test: HtmlService's inner frame has no opener, but its
// top-level Apps Script tab must retain the Alfred opener.
const emitted = [];
let messageHandler = null;
let dispatched = null;
let dispatchCount = 0;
let successHandler = null;
const statusNode = { textContent: "" };
const alfredWindow = {
  closed: false,
  postMessage(message, targetOrigin) { emitted.push({ message, targetOrigin }); },
};
const topWindow = { opener: alfredWindow };
const htmlWindow = {
  opener: null,
  top: topWindow,
  addEventListener(type, handler) { if (type === "message") messageHandler = handler; },
};
const scriptRunner = {
  withSuccessHandler(handler) { successHandler = handler; return this; },
  withFailureHandler() { return this; },
  rpcDispatch(request) { dispatched = request; dispatchCount += 1; successHandler({ connected: true }); return this; },
};
vm.runInNewContext(clientScript, {
  window: htmlWindow,
  document: { getElementById: () => statusNode },
  google: { script: { run: scriptRunner } },
});
if (!messageHandler || emitted[0]?.message?.type !== "ready" ||
    emitted[0]?.targetOrigin !== "https://bm000001.github.io") {
  throw new Error("Apps Script sandbox could not establish the opener handshake.");
}
messageHandler({
  origin: "https://bm000001.github.io",
  source: alfredWindow,
  data: {
    channel: "alfred-google-calendar",
    type: "rpc",
    nonce: "test-nonce",
    requestId: "1",
    request: { method: "session" },
  },
});
if (!dispatched || dispatched.method !== "session" ||
    emitted[1]?.message?.type !== "rpc-result" ||
    emitted[1]?.message?.requestId !== "1" || dispatchCount !== 1) {
  throw new Error("Apps Script bridge failed its RPC request/response contract.");
}
const callCount = emitted.length;
messageHandler({
  origin: "https://bm000001.github.io",
  source: alfredWindow,
  data: {
    channel: "alfred-google-calendar",
    type: "rpc",
    nonce: "test-nonce",
    requestId: "1",
    request: { method: "createEvent", params: { calendarId: "primary" } },
  },
});
messageHandler({
  origin: "https://bm000001.github.io",
  source: alfredWindow,
  data: {
    channel: "alfred-google-calendar",
    type: "rpc",
    nonce: "test-nonce",
    requestId: "not-numeric",
    request: { method: "createEvent", params: { calendarId: "primary" } },
  },
});
if (dispatchCount !== 1 || emitted.length !== callCount) {
  throw new Error("Apps Script bridge executed a replayed or malformed RPC request ID.");
}
messageHandler({
  origin: "https://attacker.example",
  source: alfredWindow,
  data: { channel: "alfred-google-calendar", type: "rpc", nonce: "test-nonce", request: { method: "session" } },
});
if (emitted.length !== callCount) {
  throw new Error("Apps Script bridge accepted a message from an untrusted origin.");
}
messageHandler({
  origin: "https://bm000001.github.io",
  source: { closed: false, postMessage() {} },
  data: { channel: "alfred-google-calendar", type: "rpc", nonce: "test-nonce", requestId: "wrong-source", request: { method: "session" } },
});
messageHandler({
  origin: "https://bm000001.github.io",
  source: alfredWindow,
  data: { channel: "alfred-google-calendar", type: "rpc", nonce: "wrong-nonce", requestId: "wrong-nonce", request: { method: "session" } },
});
if (emitted.length !== callCount) {
  throw new Error("Apps Script bridge accepted an untrusted source or nonce.");
}


// Server-side RPC contract tests with mocked Apps Script and Google HTTP APIs.
const serverCalls = [];
const serverResponses = [];
let requiredScopes = 0;
const serverContext = {
  ScriptApp: {
    AuthMode: { FULL: "FULL" },
    requireAllScopes(mode) {
      if (mode !== "FULL") throw new Error("Unexpected Apps Script auth mode.");
      requiredScopes += 1;
    },
    getOAuthToken() { return "server-only-test-token"; },
  },
  UrlFetchApp: {
    fetch(url, options) {
      serverCalls.push({ url, options });
      const response = serverResponses.shift();
      if (!response) throw new Error("Unexpected Google API request.");
      return {
        getResponseCode: () => response.status,
        getContentText: () => response.body ?? "",
      };
    },
  },
};
vm.createContext(serverContext);
vm.runInContext(server, serverContext);
const invokeServer = (request) => vm.runInContext(
  "rpcDispatch(" + JSON.stringify(request) + ")",
  serverContext,
);

serverResponses.push({ status: 200, body: JSON.stringify({ sub: "google-subject", email: "owner@example.com" }) });
const sessionResult = invokeServer({ method: "session" });
if (sessionResult.accountId !== "google-subject" || sessionResult.email !== "owner@example.com" ||
    serverCalls[0]?.options?.headers?.Authorization !== "Bearer server-only-test-token") {
  throw new Error("Apps Script session identity or server-side OAuth token handling failed.");
}

serverResponses.push({ status: 200, body: JSON.stringify({ items: [{ id: "primary" }] }) });
invokeServer({ method: "calendars", params: { pageToken: "next page" } });
if (!serverCalls[1]?.url?.includes("pageToken=next%20page")) {
  throw new Error("Calendar list pagination parameter was not encoded correctly.");
}

serverResponses.push({ status: 200, body: JSON.stringify({ items: [], nextSyncToken: "sync-next" }) });
invokeServer({ method: "events", params: { calendarId: "owner@example.com", syncToken: "sync-token", singleEvents: true } });
if (!serverCalls[2]?.url?.includes("/calendars/owner%40example.com/events?") ||
    !serverCalls[2]?.url?.includes("syncToken=sync-token") ||
    !serverCalls[2]?.url?.includes("singleEvents=true") ||
    !serverCalls[2]?.url?.includes("showDeleted=true")) {
  throw new Error("Google Calendar event pagination/sync query contract failed.");
}

const stableEventId = "0123456789abcdef0123456789abcdef";
const stableOperationId = stableEventId;
serverResponses.push({ status: 200, body: JSON.stringify({ id: stableEventId, etag: "etag-created" }) });
invokeServer({
  method: "createEvent",
  params: { calendarId: "primary", eventId: stableEventId, operationId: stableOperationId,
    event: { summary: "Teste", start: { dateTime: "2026-11-07T10:00:00Z" }, end: { dateTime: "2026-11-07T11:00:00Z" }, ignoredField: "must-not-pass" } },
});
const createCall = serverCalls[3];
const createPayload = JSON.parse(createCall.options.payload);
if (createCall.options.method !== "post" || createPayload.ignoredField !== undefined ||
    createPayload.summary !== "Teste" || createPayload.id !== stableEventId ||
    createPayload.extendedProperties.private.alfredOperationId !== stableOperationId) {
  throw new Error("Google Calendar create payload or stable operation marker failed.");
}

// Simulate a lost response followed by a retry: Google reports ID conflict,
// then returns the existing event. Only the matching private marker is accepted.
serverResponses.push({ status: 409, body: JSON.stringify({ error: { message: "Already exists" } }) });
serverResponses.push({ status: 200, body: JSON.stringify({
  id: stableEventId, extendedProperties: { private: { alfredOperationId: stableOperationId } },
}) });
const retryResult = invokeServer({
  method: "createEvent",
  params: { calendarId: "primary", eventId: stableEventId, operationId: stableOperationId,
    event: { summary: "Teste", start: { dateTime: "2026-11-07T10:00:00Z" }, end: { dateTime: "2026-11-07T11:00:00Z" } } },
});
if (retryResult.id !== stableEventId || serverCalls[4].options.method !== "post" ||
    serverCalls[5].options.method !== "get") {
  throw new Error("Google Calendar create retry did not recover the matching existing event.");
}

// An existing event ID with a different marker must never be adopted.
serverResponses.push({ status: 409, body: JSON.stringify({ error: { message: "Already exists" } }) });
serverResponses.push({ status: 200, body: JSON.stringify({
  id: stableEventId, extendedProperties: { private: { alfredOperationId: "ffffffffffffffffffffffffffffffff" } },
}) });
let foreignEventRejected = false;
try {
  invokeServer({
    method: "createEvent",
    params: { calendarId: "primary", eventId: stableEventId, operationId: stableOperationId,
      event: { summary: "Teste", start: { dateTime: "2026-11-07T10:00:00Z" }, end: { dateTime: "2026-11-07T11:00:00Z" } } },
  });
} catch (error) {
  foreignEventRejected = String(error.message).includes("não pertence a esta operação");
}
if (!foreignEventRejected || serverCalls[7].options.method !== "get") {
  throw new Error("Google Calendar create retry adopted an event with a foreign operation marker.");
}

serverResponses.push({ status: 200, body: JSON.stringify({ id: "created", etag: "etag-updated" }) });
invokeServer({
  method: "updateEvent",
  params: { calendarId: "primary", eventId: "created", etag: "etag-v1", event: { summary: "Atualizado", start: { dateTime: "2026-11-07T10:00:00Z" }, end: { dateTime: "2026-11-07T11:00:00Z" } } },
});
if (serverCalls[8].options.method !== "patch" || serverCalls[8].options.headers["If-Match"] !== "etag-v1") {
  throw new Error("Google Calendar update must use PATCH and preserve If-Match.");
}

// A retry with a stale ETag is complete only when a GET confirms the desired
// state is already present; a different current event remains a conflict.
serverResponses.push({ status: 412, body: JSON.stringify({ error: { message: "ETag conflict" } }) });
serverResponses.push({ status: 200, body: JSON.stringify({
  summary: "Atualizado", description: "", location: "",
  start: { dateTime: "2026-11-07T10:00:00Z" }, end: { dateTime: "2026-11-07T11:00:00Z" },
}) });
const updateRetry = invokeServer({
  method: "updateEvent",
  params: { calendarId: "primary", eventId: "created", etag: "etag-v1",
    event: { summary: "Atualizado", start: { dateTime: "2026-11-07T10:00:00Z" }, end: { dateTime: "2026-11-07T11:00:00Z" } } },
});
if (updateRetry.summary !== "Atualizado" || serverCalls[9].options.method !== "patch" ||
    serverCalls[10].options.method !== "get") {
  throw new Error("Google Calendar update retry did not verify the already-applied desired state.");
}

serverResponses.push({ status: 204, body: "" });
const deleteResult = invokeServer({ method: "deleteEvent", params: { calendarId: "primary", eventId: "created", etag: "etag-v2" } });
if (!deleteResult.deleted || serverCalls[11].options.method !== "delete" ||
    serverCalls[11].options.headers["If-Match"] !== "etag-v2") {
  throw new Error("Google Calendar delete/If-Match contract failed.");
}

// A repeated delete after a lost 204 is idempotent when the same event is absent.
serverResponses.push({ status: 404, body: JSON.stringify({ error: { message: "Not found" } }) });
const deleteRetry = invokeServer({ method: "deleteEvent", params: { calendarId: "primary", eventId: "created", etag: "etag-v2" } });
if (!deleteRetry.deleted || !deleteRetry.alreadyAbsent || serverCalls[12].options.method !== "delete") {
  throw new Error("Google Calendar delete retry did not accept an already-absent target.");
}

let invalidMethodRejected = false;
try { invokeServer({ method: "arbitraryMethod" }); } catch (_) { invalidMethodRejected = true; }
if (!invalidMethodRejected || serverCalls.length !== 13) {
  throw new Error("Apps Script RPC dispatcher accepted a method outside its allowlist.");
}
let invalidEventRejected = false;
try { invokeServer({ method: "createEvent", params: { calendarId: "primary", eventId: stableEventId, operationId: stableOperationId, event: { summary: "missing dates" } } }); }
catch (_) { invalidEventRejected = true; }
if (!invalidEventRejected || serverCalls.length !== 13 || requiredScopes !== 12) {
  throw new Error("Apps Script event validation or per-request scope enforcement failed.");
}

serverResponses.push({ status: 412, body: JSON.stringify({ error: { message: "ETag conflict" } }) });
serverResponses.push({ status: 200, body: JSON.stringify({
  summary: "Alterado externamente", description: "", location: "",
  start: { dateTime: "2026-11-07T12:00:00Z" }, end: { dateTime: "2026-11-07T13:00:00Z" },
}) });
let conflictMapped = false;
try {
  invokeServer({
    method: "updateEvent",
    params: { calendarId: "primary", eventId: "created", etag: "stale", event: { summary: "x", start: { dateTime: "2026-11-07T10:00:00Z" }, end: { dateTime: "2026-11-07T11:00:00Z" } } },
  });
} catch (error) {
  conflictMapped = String(error.message).includes("HTTP 409");
}
if (!conflictMapped) throw new Error("Google ETag HTTP 412 must be surfaced as a recoverable conflict.");


// Safe writes: a missing or wildcard ETag must be rejected before any
// outgoing Google Calendar request, including when the RPC is invoked directly.
const protectedWritesStart = serverCalls.length;
const testEvent = { summary: "Protegido", start: { dateTime: "2026-11-07T10:00:00Z" },
  end: { dateTime: "2026-11-07T11:00:00Z" } };
for (const method of ["updateEvent", "deleteEvent"]) {
  for (const etag of [undefined, "", "*", "  "]) {
    let rejected = false;
    try { invokeServer({ method, params: { calendarId: "primary", eventId: "created", etag, event: testEvent } }); }
    catch (error) { rejected = String(error.message).includes("ETag obrigatório"); }
    if (!rejected || serverCalls.length !== protectedWritesStart) {
      throw new Error("Google Calendar " + method + " permitted a write without a specific ETag.");
    }
  }
}
if (!bridgeClient.includes("function requireVersionEtag") ||
    !bridgeClient.includes("etag: requireVersionEtag(etag)")) {
  throw new Error("Browser client is missing its ETag preflight.");
}
console.log("Google Calendar protected writes reject missing and wildcard ETags.");
