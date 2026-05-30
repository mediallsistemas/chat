/**
 * HTTP / sync contracts between services.
 *
 * Async event-based communication uses @mediall/events. This package is for
 * the few cases where service A needs a synchronous read from service B
 * (e.g. transcription-svc asking the monolith for meeting metadata).
 */
export * from './schemas/meetings-read'
