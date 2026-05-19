## Remoção do campo `status` do professor

Vamos remover totalmente a coluna `status` da tabela `professors` e tudo que depende dela. O `status` das **contestações** continua intacto.

### 1. Banco de dados (migração)
- `ALTER TABLE public.professors DROP COLUMN status;`
- (Não há trigger nem RLS que dependa dessa coluna.)

### 2. Edge Functions
- `supabase/functions/custom-login/index.ts`
  - Remover `status` dos `select(...)` de `professors`.
  - Remover o bloco `if (professor.status === "Inativo") { return 403 }`.
  - Remover `status` do payload retornado em `matriculas[]`.
- `supabase/functions/professor-api/index.ts`
  - Remover `status` do `select` em `action=me`.
- `supabase/functions/admin-api/index.ts`
  - Remover `status` do `select` em listagem de professores.
  - Remover `status` dos inserts/updates de professor (`create_professor`, `update_professor`, importação CSV em massa).

### 3. Frontend

**`src/contexts/AuthContext.tsx`**
- Remover `status` da interface `Professor` e dos mapeamentos (`first.status`, `found.status`).

**`src/pages/DashboardPage.tsx`**
- Remover o `Badge` de status no card "Meus Dados".
- Remover o stepper "Situação do Processo" inteiro (constantes `STEPS`, `stepColors`, `currentStepIndex` e o bloco JSX correspondente).

**`src/pages/AdminPage.tsx`**
- Remover `status` da interface `Professor`, do `formData` inicial e dos formulários de criar/editar.
- Remover os 3 cards de resumo "Validados / Pendentes / Em Análise" (e a lógica `validados/pendentes/emAnalise`).
- Remover a coluna **Status** das tabelas de professores e da seção de validação pendente.
- Remover a ação **Ativar/Inativar** (`handleToggleStatus`, ícones `UserCheck`/`UserX`) — não há mais campo para alternar.
- Ajustar o CSV de exportação de contestações (a coluna Status ali é da contestação, **mantém**).
- No template/parsing do CSV de importação de professores, remover a coluna `status`.

**`src/pages/JuridicoPage.tsx`**
- Verificar e remover qualquer referência a `professor.status` (badge/coluna), mantendo `contestacao.status`.

### 4. Tipos Supabase
- `src/integrations/supabase/types.ts` é regenerado automaticamente após a migração — não editar manualmente.

### Impactos
- Login de professor passa a ser permitido independente de "Inativo" (o controle de acesso por status some). Caso queira manter um modo de "bloquear professor", terá que ser repensado depois.
- A tela do professor fica mais enxuta: só Matrícula + dados de vínculo + cotas + ações.
- O painel admin perde os cards de resumo por status e a ação de inativar.

### Fora de escopo
- `status` das **contestações** (continua existindo e funcionando normalmente).
- `status` da tabela `users` (admin/jurídico) — não é tocado.