## Ajuste da importação de professores

Pelo enunciado, as colunas válidas passam a ser exatamente:
`nome, matricula, cpf, vinculo_inicio, vinculo_fim, total_cotas, status`
(remove-se `data_nascimento` e também `carga_horaria`, que estava no template antigo mas não consta na lista nova).

### Mudanças

**1. `src/pages/AdminPage.tsx` — template CSV de exemplo (linha 663-668)**
- Novo cabeçalho: `nome;matricula;cpf;vinculo_inicio;vinculo_fim;total_cotas;status`.
- Atualizar a linha de exemplo para refletir essas 7 colunas.

**2. `src/pages/AdminPage.tsx` — `handleFileImport` (linhas 343-391)**
Antes de enviar para o backend, validar o lote inteiro no cliente:
- Normalizar `cpf` (apenas dígitos) e `matricula` (trim).
- Ignorar linhas sem `nome` ou `cpf`.
- Detectar **CPF inválido** (≠ 11 dígitos) → lista de erros.
- Detectar **duplicidade dentro do arquivo** por `cpf` e por `matricula`.
- Detectar **duplicidade contra a base atual** comparando com a lista `professors` já carregada em memória (mesmo CPF ou mesma matrícula).
- Ao final da validação:
  - Se houver erros/duplicatas: abrir um diálogo/relatório resumido (toast + console + um modal simples ou `alert` com contagem e primeiras N ocorrências) e oferecer importar **apenas as linhas válidas/únicas** ou **cancelar**.
  - Se tudo ok: seguir o fluxo atual em chunks de 100.

**3. `supabase/functions/admin-api/index.ts` — branch `import_csv` (linhas ~205-243)**
- Remover `data_nascimento` (não existe no payload atual, ok) e remover `carga_horaria` do insert (passar a 0 implicitamente ou simplesmente omitir, mantendo default do banco).
- Após montar `toInsert`, antes do `insert`:
  - Deduplicar por `cpf` no próprio array.
  - Buscar `professors` existentes com `cpf in (...)` e descartar duplicatas, retornando contagem de inseridos vs. ignorados.
- Resposta passa a ser `{ success: true, count, skipped }` para o frontend exibir.

**4. Remover do formulário e da tabela de professores o campo `data_nascimento`?**
Não — o pedido é só sobre **importação**. O campo continua existindo no cadastro manual e na edição (linha ~933) sem alteração.

### Validações cobertas no relatório de inconsistências
- CPF ausente ou com formato inválido.
- Nome ausente.
- Datas (`vinculo_inicio`, `vinculo_fim`) em formato não reconhecido (mantém normalização atual no backend, só avisa).
- `total_cotas` não numérico.
- `status` fora de {ATIVO, INATIVO, PENDENTE} (apenas warning, não bloqueia).
- Duplicidade de CPF / matrícula no arquivo.
- Duplicidade de CPF / matrícula contra base atual.

### Fora de escopo
- Atualização (upsert) de professores já existentes — atualmente o fluxo é só inserção; o relatório apenas marcará e pulará duplicatas.

Quer que eu inclua um **modo "atualizar existentes"** (upsert por CPF) no mesmo fluxo, ou manter apenas inserção + skip de duplicatas?
