## Problema

Hoje:
- O botão **Modelo CSV** gera cabeçalho `nome;matricula;cpf;vinculo_inicio;vinculo_fim;total_cotas;status` — tem `status` (que já foi removido do sistema) e está faltando `carga_horaria` e `cargo`.
- O `handleFileImport` aceita as colunas `['nome','matricula','cpf','vinculo_inicio','vinculo_fim','carga_horaria','total_cotas','cargo']` (sem `status`).
- O arquivo enviado (`lista_complementar.csv`) usa exatamente esse último conjunto, ou seja, **o modelo está divergente do que o importador realmente espera**.
- Não há validação de cabeçalho: se o usuário enviar um CSV com colunas erradas, a importação segue silenciosamente e os campos viram vazios.

## Mudanças (`src/pages/AdminPage.tsx`)

### 1. Definir um único `TEMPLATE_COLUMNS` no topo do componente
```ts
const TEMPLATE_COLUMNS = [
  'nome','matricula','cpf','vinculo_inicio','vinculo_fim',
  'carga_horaria','total_cotas','cargo'
] as const;
```
Reaproveitar em três pontos (modelo, validação, parsing) — fonte única de verdade.

### 2. Corrigir o botão **Modelo CSV** (linhas 830-844)
- Trocar `headers` para `TEMPLATE_COLUMNS`.
- Atualizar a linha-exemplo para incluir `carga_horaria` (`40`) e `cargo` (`PROFESSOR (A)`) e remover `status`.

### 3. Validar o cabeçalho do CSV antes de processar (em `handleFileImport`, bloco `else` do CSV, após extrair `headers`)
Lógica:
- Normalizar os headers do arquivo (já é feito: lowercase + remover BOM).
- Calcular:
  - `missing = TEMPLATE_COLUMNS.filter(c => !headers.includes(c))`
  - `extras  = headers.filter(h => h && !TEMPLATE_COLUMNS.includes(h))`
- Se `missing.length > 0` **ou** `extras.length > 0`:
  - Exibir `toast.error` com mensagem clara:
    `Colunas divergentes do modelo. Faltando: [...]. Não reconhecidas: [...]. Baixe o "Modelo CSV" e ajuste o arquivo.`
  - Abortar o `import` (return) sem abrir o modal de revisão.
- PDF segue o caminho atual (não tem header textual a validar).

### 4. Usar `TEMPLATE_COLUMNS` em vez da constante local `ALLOWED` (linha 408)
Apenas substituir a referência — comportamento inalterado.

## Fora de escopo
- Sem mudanças no edge function (já aceita esse conjunto de colunas).
- Sem mudanças no `ImportReviewDialog`.
- Sem mudanças no schema do banco.
