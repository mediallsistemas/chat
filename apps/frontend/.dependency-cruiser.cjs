/**
 * Boundary rules for the Next.js frontend.
 *
 * Mirrors the backend (plano 17) but for feature-based layout:
 *   src/app/     ← Next.js routes (pages + layouts only)
 *   src/features/<X>/  ← business domain code
 *   src/shared/  ← cross-feature utilities, UI
 *   src/components|hooks|lib|store/  ← legacy layout (still in use)
 *
 * Rules:
 *   - features/X cannot import from features/Y (use shared or @mediall/types)
 *   - shared cannot import from features
 *
 * Frontend gets more leniency than backend because:
 *   - User/Unit data is naturally cross-feature
 *   - Some features genuinely compose (kanban uses chat for task files)
 *
 * Warnings instead of errors during transition; promote to error once all
 * features are migrated to features/ layout (currently mixed with legacy
 * components/, hooks/, lib/, store/).
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
      name: 'cross-feature-import',
      severity: 'warn',
      comment:
        'A feature cannot import from another feature directly. Promote shared code to shared/ or use @mediall/types.',
      from: { path: '^src/features/([^/]+)/' },
      to: {
        path: '^src/features/(?!$1)([^/]+)/',
      },
    },
    {
      name: 'shared-no-import-features',
      severity: 'error',
      comment:
        'shared/ must NOT depend on any feature. Exception: app shell components ' +
        '(shared/components/layout/ — Sidebar, Header, app-wide notification panel) ' +
        'naturally consume auth/notifications/units stores. Pure UI in shared/ui/ ' +
        'must remain feature-free.',
      from: {
        path: '^src/shared/',
        pathNot:
          '^src/shared/components/layout/|^src/shared/components/notification-panel',
      },
      to: { path: '^src/features/' },
    },
    {
      name: 'shared-no-import-app',
      severity: 'error',
      comment: 'shared/ must NOT depend on app/ routes.',
      from: { path: '^src/shared/' },
      to: { path: '^src/app/' },
    },
    {
      name: 'features-no-import-app',
      severity: 'error',
      comment: 'features/ must NOT depend on app/ routes — they should be route-agnostic.',
      from: { path: '^src/features/' },
      to: { path: '^src/app/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules|\\.next' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
  },
}
