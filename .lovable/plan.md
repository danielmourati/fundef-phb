

# Plano de Segurança do Banco de Dados FUNDEF

## Diagnóstico Atual — Vulnerabilidades Críticas

O sistema possui **12 alertas de segurança** e várias falhas graves:

1. **Todas as políticas RLS são `true`** — qualquer pessoa com a chave pública (anon key) pode ler, editar e deletar TODOS os dados (CPFs, nomes, matrículas, senhas) diretamente pela API, sem precisar fazer login. Isso é equivalente a não ter segurança nenhuma.

2. **Senhas armazenadas em texto puro** — a coluna `senha` na tabela `professors` guarda a senha sem criptografia. Se alguém acessar o banco, tem todas as senhas.

3. **Autenticação via localStorage** — o role do usuário (admin/professor) é verificado apenas no cliente. Qualquer pessoa pode manipular o localStorage e se passar por admin.

4. **Sem rate limiting** — não há proteção contra tentativas de força bruta no login.

---

## Plano de Correção

### 1. Migrar autenticação para o sistema nativo do Lovable Cloud

Em vez de verificar matrícula/senha diretamente no banco pelo frontend, usar o sistema de autenticação nativo (que já vem com proteção contra força bruta, sessões seguras e tokens JWT).

- Criar uma Edge Function `custom-login` que:
  - Recebe matrícula e senha
  - Busca o professor no banco (usando service role, no servidor)
  - Verifica a senha com hash bcrypt
  - Retorna um token de sessão seguro
- O frontend nunca mais consulta a tabela `professors` diretamente para login

### 2. Criptografar senhas com bcrypt

- Criar migração para adicionar coluna `senha_hash`
- Edge Function para gerar hashes das senhas existentes
- Remover a coluna `senha` (texto puro) após migração

### 3. Restringir políticas RLS — eliminar todos os `true`

Novas políticas:

**Tabela `professors`:**
- SELECT: apenas via Edge Function (service role). O frontend não lê essa tabela diretamente.
- INSERT/UPDATE/DELETE: bloqueado para anon e authenticated. Apenas service role (Edge Functions do admin).

**Tabela `contestacoes`:**
- INSERT: permitido via Edge Function autenticada (professor logado pode criar a sua)
- SELECT: professor vê apenas as suas; admin vê todas (via Edge Function)
- UPDATE/DELETE: apenas via Edge Function com role admin

**Tabela `system_settings`:**
- Acesso total apenas via Edge Function com role admin

### 4. Ocultar dados sensíveis do frontend

- Criar uma VIEW `professors_public` que exclui CPF, senha, data de nascimento
- O dashboard do professor recebe apenas os dados necessários via Edge Function
- CPFs e dados sensíveis só são visíveis no painel admin, servidos por Edge Function autenticada

### 5. Proteção contra scraping na API

- **Remover acesso anon** a todas as tabelas — nenhum dado acessível sem autenticação
- **Rate limiting** na Edge Function de login (máx. 5 tentativas por IP em 15 min)
- **Validação de input** com Zod em todas as Edge Functions
- **Logs de auditoria** — registrar tentativas de login falhadas

### 6. Proteção da rota admin no servidor

- A verificação de admin passa a ser feita no servidor (Edge Function), não no localStorage
- Criar tabela `user_roles` separada seguindo as melhores práticas de segurança

---

## Resumo das mudanças técnicas

| Componente | Antes | Depois |
|---|---|---|
| Senhas | Texto puro | Hash bcrypt |
| RLS | Tudo `true` (aberto) | Restrito por role |
| Login | Frontend consulta banco | Edge Function com rate limit |
| Admin check | localStorage | Validação server-side |
| Dados sensíveis | Expostos na API | Filtrados por Edge Function |
| Scraping | Possível (anon lê tudo) | Bloqueado (sem acesso anon) |

---

## Arquivos afetados

- **Nova Edge Function**: `supabase/functions/custom-login/index.ts`
- **Nova Edge Function**: `supabase/functions/admin-api/index.ts` (CRUD professors, contestações)
- **Nova Edge Function**: `supabase/functions/professor-api/index.ts` (dashboard, contestações próprias)
- **Migração SQL**: hash de senhas, novas RLS policies, tabela `user_roles`, remoção de policies `true`
- **`src/contexts/AuthContext.tsx`**: usar Edge Functions em vez de query direta
- **`src/pages/AdminPage.tsx`**: chamar Edge Functions
- **`src/pages/DashboardPage.tsx`**: chamar Edge Functions

Deseja que eu implemente esse plano?

