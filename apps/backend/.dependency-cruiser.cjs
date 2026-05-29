/**
 * Boundary rules for the Modular Monolith (plano 17).
 *
 * Forbids cross-context imports. Each context must communicate via:
 *   - shared/events (EventBus / DomainEvent subclasses)
 *   - shared/ports (read models / cross-cutting interfaces)
 *   - @mediall/types
 *
 * Allowed dependencies:
 *   contexts/X -> contexts/X/**
 *   contexts/X -> shared/**
 *   contexts/X -> infrastructure/**
 *   contexts/X -> prisma/**
 *   contexts/X -> @mediall/types
 *
 * NOTE: this config is permissive while we finish migrating the legacy modules.
 * The `cross-context-import` rule is `warn` so CI keeps building; promote to
 * `error` once the migration of remaining direct cross-context imports completes.
 */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      comment: 'Circular dependencies indicate weak module boundaries.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'cross-context-import',
      severity: 'warn',
      comment:
        'A context cannot import from another context directly. Use shared/events, shared/ports, or @mediall/types instead.',
      from: { path: '^src/contexts/([^/]+)/' },
      to: {
        path: '^src/contexts/(?!$1)([^/]+)/',
        pathNot: '^src/contexts/[^/]+/shared',
      },
    },
    {
      name: 'context-no-import-legacy-roots',
      severity: 'warn',
      comment:
        'Contexts should not import from legacy root folders (notifications, jobs, transcription) that still live outside contexts/. Replace with EventBus where possible.',
      from: { path: '^src/contexts/' },
      to: {
        path: '^src/(notifications|jobs|transcription|users|units|auth|consents|audit|dashboard|reports)/',
      },
    },
    {
      name: 'no-orphans',
      severity: 'info',
      comment: 'Module is not imported anywhere — possibly dead code.',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|ts)$',
          '\\.d\\.ts$',
          '(^|/)main\\.ts$',
          '(^|/)tsconfig.*\\.json$',
        ],
      },
      to: {},
    },
    {
      name: 'shared-no-import-contexts',
      severity: 'error',
      comment: 'Shared must NOT depend on any context — that would invert the dependency.',
      from: { path: '^src/shared/' },
      to: { path: '^src/contexts/' },
    },
    {
      name: 'infrastructure-no-import-contexts',
      severity: 'warn',
      comment:
        'Infrastructure should not depend on contexts. Inversion of control via ports is preferred.',
      /**
       * Exception: the realtime gateway handler bridges domain events to socket emissions
       * and necessarily knows about event shapes from many contexts. This is an accepted
       * inversion that will be cleaned up when events move to shared/events (plano 17).
       */
      from: {
        path: '^src/infrastructure/',
        pathNot: '^src/infrastructure/gateway/realtime-event\\.handler\\.ts$',
      },
      to: { path: '^src/contexts/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    // No exclusions needed: the abandoned DDD scaffolding has been removed.
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
      archi: {
        collapsePattern: '^(node_modules|packages|src/(shared|infrastructure|contexts/[^/]+))',
      },
    },
  },
}
