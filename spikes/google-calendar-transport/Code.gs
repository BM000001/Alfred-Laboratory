/**
 * Alfred Google Calendar transport spike.
 * This is a transport-only proof of concept: it does not read or write Calendar.
 * Deploy as a Web App:
 *   Execute as: User accessing the web app
 *   Who has access: Only myself
 */
function doGet() {
  return HtmlService
    .createHtmlOutputFromFile('Index')
    .setTitle('Alfred Google Calendar transport test')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * The only server function exposed in this spike.
 * google.script.run serializes plain objects; do not return Apps Script objects.
 */
function health(request) {
  if (!request || request.protocolVersion !== 1) {
    throw new Error('Unsupported protocol version.');
  }
  if (typeof request.requestId !== 'string' ||
      request.requestId.length < 1 ||
      request.requestId.length > 100) {
    throw new Error('Invalid requestId.');
  }

  return {
    protocolVersion: 1,
    requestId: request.requestId,
    ok: true,
    data: {
      status: 'ok',
      serverTime: new Date().toISOString(),
      transport: 'google.script.run'
    },
    error: null
  };
}
