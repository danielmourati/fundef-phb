

## Análise da situação

O projeto **já está usando Supabase** (Lovable Cloud, que é Supabase nos bastidores). O banco atual tem:
- Tabelas: `professors`, `contestacoes`, `messages`, `message_reads`, `login_attempts`, `system_settings`
- Edge functions: `custom-login`, `admin-api`, `professor-api`
- Funções SQL: `hash_password`, `verify_password`, `generate_protocolo`
- Project ref atual: `opmpgzaejeoptrajhrbt`

Então "migrar para o Supabase" provavelmente significa uma destas três coisas. Preciso confirmar com você qual é o objetivo antes de montar o plano técnico.

## Cenários possíveis

**Cenário A — Migrar para um projeto Supabase próprio (fora do Lovable Cloud)**
Você cria uma conta em supabase.com, cria um novo projeto, e movemos schema + dados para lá. O app passa a apontar para essa nova URL/chave. Vantagem: controle total via dashboard do Supabase. Desvantagem: perde a integração automática do Lovable Cloud.

**Cenário B — Exportar dados do Lovable Cloud atual para outro Supabase existente**
Você já tem um projeto Supabase e quer mover os dados deste app para lá.

**Cenário C — Apenas exportar backup do banco atual**
Gerar um dump SQL com schema + dados para você guardar/migrar manualmente.

## Informações que preciso de você

1. **Qual cenário acima** (A, B ou C)?
2. Se A ou B: você já tem **conta no supabase.com**? Se sim, preciso de:
   - Project URL (ex: `https://xxxxx.supabase.co`)
   - Anon/Publishable key
   - Service role key (para rodar a migração — será guardada como secret)
   - Senha do banco (ou string de conexão `postgresql://...`) para importar o dump
3. Quer migrar **apenas o schema** (estrutura vazia) ou **schema + todos os dados atuais** (professores, contestações, mensagens, etc.)?
4. Quer manter o **Lovable Cloud ativo em paralelo** durante a transição, ou cortar de vez?

## Passo a passo geral (válido para Cenário A)

1. **Criar projeto no Supabase.com** — você faz isso no painel deles e me envia as credenciais.
2. **Exportar o schema atual** — eu gero um arquivo `.sql` com todas as tabelas, funções, triggers e sequences do banco atual.
3. **Exportar os dados** — gero `COPY ... TO STDOUT` em CSV para cada tabela ou um `pg_dump` completo (entrego em `/mnt/documents/`).
4. **Importar no novo Supabase** — aplico o schema e depois carrego os dados via `psql` usando a connection string que você fornecer.
5. **Recriar extensões** — `pgcrypto` (usada por `hash_password`/`verify_password`) precisa estar habilitada no novo projeto.
6. **Reimplantar edge functions** — `custom-login`, `admin-api`, `professor-api` precisam ser deployadas no novo projeto via CLI Supabase (eu te passo os comandos).
7. **Configurar secrets no novo projeto** — `SUPABASE_SERVICE_ROLE_KEY` (gerado automaticamente), `LOVABLE_API_KEY` (se for manter recursos de IA — talvez não funcione fora do Lovable Cloud).
8. **Atualizar `.env` do app** — trocar `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` para apontar ao novo projeto.
9. **Regenerar `src/integrations/supabase/types.ts`** com o novo project ref.
10. **Testes** — login, CRUD de professores, contestações, exportação PDF, mensagens.

## Atenção / riscos

- O recurso **Lovable AI** (`LOVABLE_API_KEY`) só funciona dentro do Lovable Cloud. Hoje ele não está sendo usado nas edge functions atuais, então não deve haver impacto.
- Senhas estão em **bcrypt** (`pgcrypto`) — funcionarão no novo projeto desde que `pgcrypto` esteja habilitado. Os usuários não precisarão redefinir senha.
- Tabelas hoje **não têm RLS habilitado** (todo acesso é via edge function com service role). No novo projeto isso continua funcionando igual, mas é uma boa hora para ativar RLS se quiser.
- Uma vez migrado, **não há como desfazer** o desligamento do Lovable Cloud sem recriar do zero.

## Próximo passo

Me responda com o cenário (A/B/C) e as credenciais (se aplicável). Com isso eu monto o plano de execução detalhado e os scripts de migração.

