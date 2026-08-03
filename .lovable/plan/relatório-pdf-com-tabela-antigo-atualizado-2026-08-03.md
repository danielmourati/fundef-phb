# Relatório PDF com tabela "Antigo → Atualizado"

## Situação atual (verificada)

- O backfill (`backfill_import_logs` em `supabase/functions/admin-api/index.ts`) reconstrói os lotes de hoje a partir de `professors` / `contratados`, mas essas tabelas guardam apenas o **valor atual** de cada campo. Por isso os itens gravados hoje têm apenas nome, CPF e matrícula, sem `diffs`.
- O PDF (`src/lib/importReportPdf.ts`) já imprime alterações campo a campo quando o item traz `diffs` (`Atual:` / `Novo:`), em linhas de texto — não em tabela com colunas nomeadas.

## O que será feito

### 1. Histórico de alterações no banco
Nova tabela de auditoria que registra, a cada alteração de professor efetivo ou contratado, o campo alterado, o valor antigo e o valor novo, com data/hora e o registro afetado. Preenchida automaticamente pelo próprio banco (gatilho), portanto vale para importações, edições manuais e qualquer outro caminho.

### 2. Botão "Recuperar importações de hoje" passa a usar o histórico
O botão continua reconstruindo os lotes do dia, mas agora monta cada linha com os campos realmente alterados, trazendo valor antigo e valor novo. Para os lotes de hoje que já rodaram antes da auditoria existir, o valor antigo aparece como "não registrado" — é uma limitação honesta, não há esse dado no banco.

### 3. Tabela de duas colunas no PDF
O relatório em PDF passa a exibir, para cada registro atualizado, uma tabela com cabeçalho e três colunas visíveis:

```text
Linha 42 — MARIA DA SILVA (CPF 000.000.000-00 / Mat. 2878)
  Campo              Dado antigo            Dado atualizado
  Total de cotas     12                     18
  Cargo              PROFESSOR EJA          PROFESSOR(A) EJA
```

- Cabeçalho repetido quando a tabela quebra de página.
- Linhas zebradas e bordas para leitura fácil; textos longos quebram em várias linhas dentro da célula, sem cortar.
- O modal "Ver detalhes" permanece como está hoje (mudança apenas no PDF, conforme escolhido).

## Detalhes técnicos

- Migração: `public.record_changes` (`table_name`, `record_id`, `field`, `old_value`, `new_value`, `changed_at`) + GRANT para `service_role`, RLS habilitada com política restritiva `deny_all_client_access`, índice por `changed_at desc` e por `record_id`. Função `public.log_record_changes()` (`SECURITY DEFINER`, `search_path = public`) comparando os campos relevantes em `BEFORE UPDATE`, com triggers em `professors` e `contratados`.
- `supabase/functions/admin-api/index.ts`: `backfill_import_logs` consulta `record_changes` na janela de cada lote e preenche `items[].diffs` (`field`, `label`, `current`, `incoming`), marcando `current: null` quando não houver histórico.
- `src/lib/importReportPdf.ts`: substituir o bloco de diffs por um renderizador de tabela (`drawDiffTable`) com colunas Campo / Dado antigo / Dado atualizado, cabeçalho repetido por página e `splitTextToSize` por célula; "não registrado" em cinza quando `current` for nulo.

## Critério de aceite

- Toda atualização futura em efetivos e contratados fica registrada com valor antigo e novo.
- O PDF de um relatório reconstruído mostra a tabela de duas colunas nomeadas por registro alterado.
- Sem texto cortado ou sobreposto em arquivos grandes, com cabeçalho de tabela repetido nas quebras de página.
