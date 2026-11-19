import type { StudyEnhancementRequest } from './studyEnhancementProvider';
import { validateStudyEnhancement } from './studyEnhancementValidation';

const MAX_WIRE_BYTES = 32 * 1024;

/** v0 uses snake_case. This adapter performs no I/O. */
export function encodeStudyEnhancement(request: StudyEnhancementRequest, signal?: AbortSignal): string {
  signal?.throwIfAborted();
  if (request.consent.externalProcessing !== true) throw new Error('consent_required');
  const payload = JSON.stringify({
    version: request.version, request_id: request.requestId, source_file_id: request.sourceFileId,
    discipline_id: request.disciplineId, topic_id: request.topicId, profile: request.profile, task: request.task,
    chunks: request.chunks.map(({ chunkId, pageNumber, text }) => ({ chunk_id: chunkId, page_number: pageNumber, text })),
    consent: { external_processing: true, external_ai: request.consent.externalAi },
  });
  if (new TextEncoder().encode(payload).length > MAX_WIRE_BYTES) throw new Error('payload_too_large');
  return payload;
}

/** The isolated server currently emits only empty, non-ready envelopes. */
export function validateStudyEnhancementWire(
  request: StudyEnhancementRequest, body: string, context: Parameters<typeof validateStudyEnhancement>[2], signal?: AbortSignal,
) {
  const invalid = { status: 'rejected' as const, issues: ['invalid_wire_response'] };
  if (signal?.aborted) return { status: 'rejected' as const, issues: ['cancelled'] };
  if (body.length > MAX_WIRE_BYTES || new TextEncoder().encode(body).length > MAX_WIRE_BYTES) return invalid;
  try {
    const result = JSON.parse(body);
    const fields = ['version', 'request_id', 'status', 'provider_kind', 'items', 'evidence', 'warnings'];
    if (!result || Object.keys(result).length !== fields.length || !fields.every(key => Object.hasOwn(result, key)) ||
        !Array.isArray(result.items) || result.items.length || !Array.isArray(result.evidence) || result.evidence.length) return invalid;
    return validateStudyEnhancement(request, {
      version: result.version, requestId: result.request_id, status: result.status, providerKind: result.provider_kind,
      flashcards: [], questions: [], evidence: [], warnings: result.warnings,
    }, context, signal);
  } catch {
    return invalid;
  }
}
