/**
 * Cross-service event schemas (Zod-validated).
 *
 * These schemas are the contract between the monolith and extracted services
 * (transcription-svc, future realtime-svc). Versioned via the `version` field
 * — bump when making breaking changes.
 *
 * Transport: Redis Streams (one stream per topic).
 */
export * from './schemas/transcription'
export * from './schemas/meetings'
export * from './schemas/notifications'
export * from './stream-names'
