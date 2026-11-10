/**
 * Alfred Google Calendar bridge.
 *
 * IMPORTANT: Deploy this Web App as "User accessing the web app".
 * Never deploy as the script owner: that would expose the owner's calendar.
 * OAuth access tokens stay server-side and are never returned to the browser.
 */
const ALFRED_ORIGIN = "https://bm000001.github.io";
const GOOGLE_API_BASE = "https://www.googleapis.com/calendar/v3";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const MAX_EVENT_BODY_CHARS = 32000;

function doGet(e) {
  const nonce = String((e && e.parameter && e.parameter.nonce) || "");
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(nonce)) {
    return HtmlService.createHtmlOutput("Abra esta integração pelo botão Conectar do Alfred.");
  }
  const template = HtmlService.createTemplateFromFile("Index");
  template.bridgeNonce = nonce;
  template.alfredOrigin = ALFRED_ORIGIN;
  return template.evaluate()
    .setTitle("Alfred — Google Calendar")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

/**
 * Single allowlisted RPC entry point used by the Alfred popup.
 * google.script.run only exposes this dispatcher to the browser.
 */
function rpcDispatch(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) {
    throw new Error("Solicitação inválida.");
  }
  const serialized = JSON.stringify(request);
  if (serialized.length > 40000) throw new Error("Solicitação excede o limite permitido.");
  const method = String(request.method || "");
  const params = request.params && typeof request.params === "object" && !Array.isArray(request.params)
    ? request.params
    : {};

  // Fail closed if the user has not granted every explicit least-privilege
  // scope in the manifest. Apps Script owns the consent prompt.
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);

  // A user-scoped OAuth token is created only inside this execution context.
  // It is never returned, cached, logged, or persisted.
  const token = ScriptApp.getOAuthToken();
  switch (method) {
    case "session":
      return getSession_(token);
    case "calendars":
      return listCalendars_(token, params);
    case "events":
      return listEvents_(token, params);
    case "createEvent":
      return createEvent_(token, params);
    case "updateEvent":
      return updateEvent_(token, params);
    case "deleteEvent":
      return deleteEvent_(token, params);
    default:
      throw new Error("Operação não permitida.");
  }
}

function getSession_(token) {
  const response = UrlFetchApp.fetch(GOOGLE_USERINFO_URL, {
    method: "get",
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true,
  });
  const code = response.getResponseCode();
  if (code !== 200) throw apiError_("Não foi possível identificar a conta Google.", code);
  const identity = JSON.parse(response.getContentText());
  if (!identity || !identity.sub) throw new Error("O Google não retornou um identificador de conta válido.");
  return { connected: true, accountId: String(identity.sub), email: String(identity.email || "") };
}

function listCalendars_(token, params) {
  const query = { maxResults: "250" };
  if (params.pageToken) query.pageToken = String(params.pageToken).slice(0, 2048);
  return googleRequest_(token, "/users/me/calendarList?" + queryString_(query), "get");
}

function listEvents_(token, params) {
  const calendarId = requiredId_(params.calendarId, "calendário");
  const allowed = ["syncToken", "timeMin", "timeMax", "pageToken", "singleEvents", "orderBy"];
  const query = { maxResults: "250", showDeleted: "true" };
  allowed.forEach(function(key) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== "") {
      query[key] = String(params[key]).slice(0, 4096);
    }
  });
  return googleRequest_(token,
    "/calendars/" + encodeURIComponent(calendarId) + "/events?" + queryString_(query), "get");
}

function createEvent_(token, params) {
  const calendarId = requiredId_(params.calendarId, "calendário");
  const eventId = requiredId_(params.eventId, "evento");
  const operationId = requiredId_(params.operationId, "operação");
  if (!/^[0-9a-v]{5,1024}$/.test(eventId) || !/^[0-9a-v]{5,1024}$/.test(operationId)) {
    throw new Error("Identificador idempotente inválido.");
  }
  const body = validateEventBody_(params.event);
  body.id = eventId;
  body.extendedProperties = { private: { alfredOperationId: operationId } };
  try {
    return googleRequest_(token,
      "/calendars/" + encodeURIComponent(calendarId) + "/events", "post", body);
  } catch (error) {
    // A retry after a lost response may find that Google already created the
    // deterministic event ID. Accept it only when its private marker matches.
    if (!String(error && error.message || error).includes("HTTP 409")) throw error;
    const existing = googleRequest_(token,
      "/calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(eventId),
      "get");
    const marker = existing && existing.extendedProperties && existing.extendedProperties.private &&
      existing.extendedProperties.private.alfredOperationId;
    if (marker === operationId) return existing;
    throw new Error("O ID do evento já existe no Google, mas não pertence a esta operação. Nenhum evento foi alterado.");
  }
}

function updateEvent_(token, params) {
  const calendarId = requiredId_(params.calendarId, "calendário");
  const eventId = requiredId_(params.eventId, "evento");
  const body = validateEventBody_(params.event);
  const path = "/calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(eventId);
  const headers = { "If-Match": requiredEtag_(params.etag) };
  try {
    return googleRequest_(token, path, "patch", body, headers);
  } catch (error) {
    // A retry after a lost PATCH response receives 412 because the original
    // ETag is stale. Treat it as complete only if the current remote values
    // already equal the exact desired values; never overwrite newer edits.
    if (!String(error && error.message || error).includes("HTTP 409")) throw error;
    const current = googleRequest_(token, path, "get");
    if (eventMatchesDesired_(current, body)) return current;
    throw new Error("O evento mudou no Google e não corresponde às alterações desejadas. Revise o conflito antes de tentar novamente. (HTTP 409)");
  }
}

function deleteEvent_(token, params) {
  const calendarId = requiredId_(params.calendarId, "calendário");
  const eventId = requiredId_(params.eventId, "evento");
  const headers = { "If-Match": requiredEtag_(params.etag) };
  const path = "/calendars/" + encodeURIComponent(calendarId) + "/events/" + encodeURIComponent(eventId);
  try {
    googleRequest_(token, path, "delete", null, headers);
  } catch (error) {
    // If a prior DELETE succeeded but its response was lost, the same target
    // is now absent. A 404 is therefore an idempotent success; ETag conflicts
    // and all other failures remain visible.
    if (!String(error && error.message || error).includes("HTTP 404")) throw error;
    return { deleted: true, alreadyAbsent: true };
  }
  return { deleted: true, alreadyAbsent: false };
}

function eventMatchesDesired_(current, desired) {
  if (!current || String(current.summary || "") !== String(desired.summary || "") ||
      String(current.description || "") !== String(desired.description || "") ||
      String(current.location || "") !== String(desired.location || "")) return false;
  return eventTimeMatches_(current.start, desired.start) && eventTimeMatches_(current.end, desired.end);
}

function eventTimeMatches_(current, desired) {
  if (!current || !desired) return false;
  if (desired.date) return current.date === desired.date;
  if (desired.dateTime) {
    const currentTime = Date.parse(current.dateTime || "");
    const desiredTime = Date.parse(desired.dateTime);
    return Number.isFinite(currentTime) && Number.isFinite(desiredTime) && currentTime === desiredTime;
  }
  return false;
}

function validateEventBody_(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw new Error("Dados do evento inválidos.");
  }
  const body = JSON.stringify(event);
  if (body.length > MAX_EVENT_BODY_CHARS) throw new Error("Evento excede o limite permitido.");
  const allowed = ["summary", "description", "location", "start", "end", "recurrence", "attendees", "reminders", "visibility", "transparency", "colorId"];
  const clean = {};
  allowed.forEach(function(key) {
    if (Object.prototype.hasOwnProperty.call(event, key)) clean[key] = event[key];
  });
  if (!clean.summary || !clean.start || !clean.end) {
    throw new Error("O evento precisa ter título, início e fim.");
  }
  return clean;
}

function googleRequest_(token, path, method, body, extraHeaders) {
  const options = {
    method: method,
    headers: Object.assign({ Authorization: "Bearer " + token }, extraHeaders || {}),
    muteHttpExceptions: true,
  };
  if (body !== null && body !== undefined) {
    options.contentType = "application/json";
    options.payload = JSON.stringify(body);
  }
  const response = UrlFetchApp.fetch(GOOGLE_API_BASE + path, options);
  const status = response.getResponseCode();
  if (status === 204) return null;
  const text = response.getContentText();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch (_) { payload = {}; }
  if (status < 200 || status >= 300) {
    const mapped = status === 412 ? 409 : status;
    const message = payload && payload.error && payload.error.message
      ? String(payload.error.message)
      : "Google Calendar respondeu HTTP " + status + ".";
    throw apiError_(message, mapped);
  }
  return payload;
}

function apiError_(message, status) {
  return new Error(String(message) + " (HTTP " + Number(status) + ")");
}

function requiredEtag_(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 512 ||
      value.trim() === "*" || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error("ETag obrigatório para atualizar ou excluir eventos. Sincronize novamente antes de continuar.");
  }
  return value.trim();
}

function requiredId_(value, label) {
  const result = String(value || "");
  if (!result || result.length > 1024 || /[\u0000-\u001f]/.test(result)) {
    throw new Error("Identificador de " + label + " inválido.");
  }
  return result;
}

function queryString_(values) {
  return Object.keys(values).map(function(key) {
    return encodeURIComponent(key) + "=" + encodeURIComponent(values[key]);
  }).join("&");
}
