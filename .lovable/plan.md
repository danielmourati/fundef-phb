## Objetivo
Permitir, na aba **Mensagens** do `/admin`:
- Editar mensagens **programadas** (título, conteúdo, data/hora, destinatários).
- **Reenviar agora** uma mensagem já enviada (resetando leituras).
- **Duplicar** uma mensagem como nova (rascunho/programada).
- Selecionar **destinatários** ao criar/editar: Todos, por Cargo (role + cargo livre) ou Usuários específicos (busca por nome/matrícula).

## Banco (migration)
Adicionar à tabela `messages`:
- `target_type text not null default 'all'` — valores: `all` | `role` | `users`.
- `target_roles text[] not null default '{}'` — ex.: `{professor,juridico}`.
- `target_cargos text[] not null default '{}'` — cargos livres opcionais (ex.: `PROFESSOR I`).
- `target_user_ids uuid[] not null default '{}'` — quando `target_type = 'users'`.

Nenhuma alteração em RLS/grants (mantém acesso só via edge functions).

## Backend — `supabase/functions/admin-api/index.ts`
- `GET messages`: já existe, retornar também os novos campos de segmentação.
- `POST create_message`: aceitar `target_type`, `target_roles`, `target_cargos`, `target_user_ids` e persistir.
- **Novo** `PUT update_message`: edita `title`, `content`, `scheduled_at`, e campos de segmentação. **Só permitido** se a mensagem ainda **não foi enviada** (`sent = false`). Recalcula `sent` se `scheduled_at` for limpo.
- **Novo** `POST resend_message?id=...`: marca `sent=true`, atualiza `created_at = now()`, **apaga `message_reads` da mensagem** (reset de leituras) para reaparecer como não lida.
- **Novo** `POST duplicate_message?id=...`: copia a mensagem em uma nova linha como `sent=false` (rascunho/programada) preservando segmentação; cliente abre o diálogo de edição em seguida.
- **Novo** `GET professors_lookup?q=...&limit=20`: retorna `[{id, nome, matricula, cargo, role}]` para o autocomplete do seletor de usuários específicos (server-side, reaproveitando o filtro `.or()` já usado em `professors`).
- **Novo** `GET cargos_distinct`: lista cargos distintos para o seletor de cargos.

## Backend — `supabase/functions/professor-api/index.ts`
Atualizar o `GET messages` para entregar apenas mensagens cujo público inclua o professor:
- `target_type='all'` → sempre incluir.
- `target_type='role'` → incluir se `professor.role` ∈ `target_roles` **ou** `professor.cargo` ∈ `target_cargos`.
- `target_type='users'` → incluir se `professor.id` ∈ `target_user_ids`.
- Mensagens pessoais (`created_by = user.sub`) continuam visíveis como hoje.

## Frontend — `src/pages/AdminPage.tsx` (aba Mensagens)
Diálogo único reaproveitado para **Nova** e **Editar**:
- Campos: Título, Conteúdo, Data/hora (datetime-local) e bloco **Destinatários**:
  - Radio: `Todos` | `Por cargo` | `Usuários específicos`.
  - `Por cargo`: checkboxes para `professor`, `admin`, `juridico` + multi-select de cargos (carregado de `cargos_distinct`).
  - `Usuários específicos`: campo de busca com debounce chamando `professors_lookup`, chips dos selecionados.
- Botões por mensagem na lista:
  - **Editar** (lápis) — habilitado **somente** quando `sent=false` (programada). Abre o diálogo preenchido.
  - **Reenviar agora** (ícone Send) — confirma e chama `resend_message` (reseta leituras).
  - **Duplicar** (ícone Copy) — chama `duplicate_message` e abre o diálogo de edição da cópia.
  - **Excluir** (mantido).
- Badge extra com resumo do público (ex.: “Todos”, “Cargo: Professor”, “3 usuários”).
- Toasts e refresh da lista após cada ação.

## Detalhes técnicos
- Verificar `sent=false` no backend antes de aceitar `update_message` (defesa em profundidade, além do botão estar oculto no frontend).
- `resend_message` executa `DELETE FROM message_reads WHERE message_id = $1` via service_role.
- Não modificar `src/integrations/supabase/client.ts` nem `types.ts` manualmente — após a migration, os tipos são regenerados.
- Deploy das duas edge functions (`admin-api`, `professor-api`) após as edições.

## Fora de escopo
- Agendamento real via cron (envio diferido já é simulado pelo flag `sent`/`scheduled_at` atual; mantemos o comportamento existente).
- Notificações push/e-mail.
