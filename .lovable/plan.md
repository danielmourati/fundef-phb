

# Plano: Área de Super Admin + Criação de Usuário Jurídico

## Resumo
1. Criar uma área de **Super Admin** com gestão completa de usuários (criar, editar, inativar) — na prática, o admin atual já tem essa funcionalidade na aba "Professores". Vamos aprimorá-la para suportar todos os roles (professor, admin, juridico, superadmin) e adicionar a ação de **inativar/ativar** usuários.
2. Criar o usuário do jurídico no banco de dados.
3. Corrigir o redirecionamento pós-login para o role `juridico`.

## O que será feito

### 1. Criar usuário jurídico no banco
- Inserir na tabela `professors` um registro com:
  - `matricula`: `juridico@seduc.com.br`
  - `nome`: `Corpo Jurídico`
  - `role`: `juridico`
  - `senha_hash`: hash bcrypt de `seduc@123`
  - `status`: `Ativo`

### 2. Aprimorar gestão de usuários no AdminPage
- No formulário de criar/editar professor, adicionar campo **Role** (select com opções: professor, admin, juridico).
- Adicionar botão de **Inativar/Ativar** na listagem de professores (altera o status para "Inativo"/"Ativo").
- Usuários inativos não poderão fazer login — adicionar verificação no `custom-login`.

### 3. Bloquear login de usuários inativos
- No `custom-login/index.ts`, após verificar a senha, checar se `professor.status === 'Inativo'` e retornar erro específico.

### 4. Corrigir redirecionamento pós-login
- No `LoginPage.tsx`, adicionar redirecionamento para `/juridico` quando o role for `juridico`.

## Detalhes técnicos

**Arquivos modificados:**
- `src/pages/AdminPage.tsx` — campo role no formulário, botão inativar/ativar
- `src/pages/LoginPage.tsx` — redirect para role juridico
- `supabase/functions/custom-login/index.ts` — bloqueio de login para inativos
- Inserção de dados via ferramenta de banco (usuário jurídico)

