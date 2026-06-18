-- Multitenancy plano 23.5 — Row-Level Security (defesa de banco, defense-in-depth).
--
-- Habilita RLS + FORCE + policy de isolamento por tenant em TODAS as 36 tabelas
-- tenant-scoped. A policy lê o tenant da variável de sessão `app.current_tenant_id`
-- (set_config por transação — ver runbook em docs/melhorias/23_multitenancy_saas.md).
--
-- ⚠️ INERTE enquanto o app conectar como SUPERUSER (ex.: `postgres`): superusuários
--    IGNORAM RLS, mesmo com FORCE. Para ATIVAR em produção:
--      1) criar uma role dedicada NÃO-superusuário (ex.: mediall_app);
--      2) o app conectar com essa role (DATABASE_URL);
--      3) cada request setar `app.current_tenant_id` (GUC) por transação.
--    Sem o passo (3), uma role não-superusuário vê 0 linhas (fail-closed) — por isso
--    o wiring do GUC é pré-requisito de trocar a role. Até lá, o isolamento ativo é
--    o app-layer (middleware $use, plano 23.3).
--
-- Idempotente (DROP POLICY IF EXISTS). RLS/policies não são introspectados pelo
-- Prisma, então isto não vira "drift" nas próximas migrations.

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'audit_entries', 'chat_custom_emojis', 'chat_group_members', 'chat_groups',
    'chat_huddles', 'chat_message_bookmarks', 'chat_message_reactions', 'chat_messages',
    'chat_reminders', 'consent_user_consents', 'doc_documents', 'doc_folders',
    'imp_task_impediments', 'kb_boards', 'kb_columns', 'kb_task_checklists',
    'kb_task_dependencies', 'kb_task_files', 'kb_tasks', 'meet_chat_messages',
    'meet_meetings', 'meet_participants', 'notif_notifications', 'notif_push_subscriptions',
    'notif_settings', 'strat_goals', 'strat_macro_tasks', 'strat_objectives',
    'strat_phase_scope_boards', 'strat_plan_phases', 'strat_plans', 'tkt_comments',
    'tkt_tickets', 'units', 'user_units', 'users'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I '
      'USING (tenant_id = current_setting(''app.current_tenant_id'', true)) '
      'WITH CHECK (tenant_id = current_setting(''app.current_tenant_id'', true))',
      t
    );
  END LOOP;
END $$;
