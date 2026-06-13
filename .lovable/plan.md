## Objetivo

Substituir o link "Não consegue acessar? Reportar problema" (que hoje abre WhatsApp) por um modal de formulário em `/login` para o professor reportar dificuldade de acesso. Os reports ficam armazenados no banco e podem ser analisados pelo super-admin em uma nova área no painel `/admin`.

## Mudanças

### 1. Banco de dados (nova tabela `access_reports`)

Campos:
- `nome_completo` (text, obrigatório)
- `cpf` (text, obrigatório)
- `tipo_vinculo` (text, obrigatório) — ex.: Efetivo, Contrato Temporário, Aposentado, Pensionista, Outro
- `whatsapp` (text, obrigatório)
- `email` (text, opcional)
- `assunto` (text, obrigatório) — selecionado em lista fixa
- `descricao` (text, opcional, livre)
- `status` (text, default `Aberto`) — Aberto / Em análise / Resolvido / Descartado
- `resposta_admin` (text)
- `protocolo` (text, gerado automaticamente, formato `ACC-YYYY-000000`)
- timestamps padrão

Acesso restrito (RLS deny-all no cliente; toda leitura/gravação via Edge Functions com `service_role`, padrão já adotado no projeto).

Opções fixas de **Assunto** (no front e validadas no back):
- "Meu nome foi divulgado mas não tenho cadastro"
- "Não lembro/não tenho CPF cadastrado"
- "Erro ao acessar com CPF e senha"
- "Outro"

Opções fixas de **Tipo de Vínculo**:
- "Efetivo", "Contrato Temporário", "Aposentado", "Pensionista", "Outro"

### 2. Edge Functions

- `professor-api`: nova rota pública (sem token) `action=create_access_report` — valida campos com zod, aplica rate-limit por IP (reaproveitando padrão de `login_attempts`), gera protocolo e insere no banco. Retorna `{ protocolo }`.
- `admin-api`: novas rotas (autenticadas como admin)
  - `action=list_access_reports` (com filtro opcional por status)
  - `action=update_access_report` (atualizar status e `resposta_admin`)

### 3. Frontend — `/login` (`src/pages/LoginPage.tsx`)

- Remover `handleReport` que abre WhatsApp.
- Manter o link "Não consegue acessar? Reportar problema", mas abrindo um `Dialog` (shadcn) com o formulário.
- Formulário com validação (zod + máscaras de CPF/telefone já existentes em `src/lib/masks.ts`):
  - Nome completo *
  - CPF * (com máscara)
  - Tipo de vínculo * (Select)
  - WhatsApp * (com máscara)
  - E-mail (opcional)
  - Assunto * (Select)
  - Descrição (textarea opcional, até 500 caracteres)
- Submit chama `professor-api?action=create_access_report` sem header de auth.
- Em sucesso: toast com o número de protocolo e fecha o modal.

### 4. Frontend — `/admin` (`src/pages/AdminPage.tsx`)

- Nova aba/seção "Reports de Acesso" com:
  - Lista de reports com badge de status, protocolo, data, nome, CPF e assunto.
  - Filtro por status.
  - Drawer/Dialog de detalhe permitindo: alterar status, escrever resposta interna e marcar como Resolvido/Descartado.
- Usar o mesmo padrão visual das demais seções (cards + Badge de status, igual ao de contestações).

## Detalhes técnicos

- Tabela criada via migration com `GRANT ALL ... TO service_role` (sem grants a `anon`/`authenticated`) e RLS habilitada com policy deny-all (mesmo padrão já usado em `contestacoes`, `messages`, etc.).
- Sequence `access_report_protocolo_seq` + trigger `BEFORE INSERT` para gerar `protocolo` (espelho de `generate_protocolo`).
- Rate limit no endpoint público: máx. 5 reports por IP por hora.
- Sanitização/validação no edge: trim, limites de tamanho, regex de CPF (11 dígitos) e e-mail.
- Nenhuma alteração no fluxo de login existente.

## Itens fora de escopo

- Notificações por e-mail/WhatsApp para o admin quando chega um novo report (pode ser adicionado depois).
- Vincular automaticamente um report a um cadastro existente de professor.
