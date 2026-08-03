# Reconstruir a coluna "Dado antigo" a partir da planilha anterior

## Situação atual (verificada)

- A tabela de auditoria `record_changes` está **vazia** — o gatilho passou a existir depois da importação das 10:42, então o banco não guarda os valores anteriores daquele lote.
- O relatório da imagem é o log `efetivo` de 03/08/2026 13:42 UTC com `16 importados / 51 atualizados`, sem `file_name` (marcado como "Reconstruído") e sem `diffs` nos itens.
- Portanto o "dado antigo" só pode vir de uma fonte externa: a planilha com os dados como estavam **antes** da importação (opção escolhida).

## O que será feito

1. **Novo botão em cada relatório reconstruído**: "Enviar planilha anterior" (ícone de upload) na aba Relatórios de Importação.
2. Ao enviar a planilha (.csv/.xlsx), o sistema:
   - lê as linhas e identifica cada pessoa por CPF + matrícula (ou nome + matrícula quando não houver CPF, mesma regra já usada nas importações);
   - compara cada campo do arquivo (nome, CPF, matrícula, data de nascimento, carga horária, cargo, total de cotas, status, vínculo, início/fim do vínculo) com o valor **atual** no banco;
   - grava no relatório, para cada registro que mudou, o par **dado antigo (planilha) → dado atualizado (banco)**;
   - registros presentes no relatório mas ausentes na planilha continuam com "não registrado".
3. **Consulta e PDF**: o relatório passa a exibir esses pares; o PDF já monta a tabela **Campo / Dado antigo / Dado atualizado**, então o download sai completo automaticamente.
4. **Retrocompatível e repetível**: pode-se reenviar a planilha para corrigir/completar; o relatório é atualizado no lugar, sem duplicar.
5. Importações futuras continuam usando a auditoria automática do banco — este envio manual é só para os lotes anteriores a ela.

## Detalhes técnicos

- `supabase/functions/admin-api/index.ts`: nova ação POST `apply_baseline_diffs` (admin) recebendo `{ log_id, rows }`. Normaliza os valores com os mesmos helpers já usados em `import_professors_csv` / `import_contratados` (traços/vazios ignorados, carga horária `20/40`, cotas numéricas), busca em `professors`/`contratados` pela chave composta, monta `diffs: [{ field, label, current: <planilha>, incoming: <banco> }]` e faz `update` em `import_logs.items` + `counts.baseline_applied = 1`.
- `src/components/admin/ImportLogsView.tsx`: `<input type="file">` oculto por linha reconstruída, parse com o mesmo utilitário de leitura de planilha usado no admin (XLSX/CSV → array de objetos por cabeçalho), envio em blocos de 200 linhas, toast de progresso e recarga da lista.
- `src/lib/importReportPdf.ts`: sem alteração — `drawDiffTable` já cobre o formato.

## Critério de aceite

- Após enviar a planilha anterior, o relatório das 10:42 mostra, para as 51 linhas atualizadas, o valor antigo ao lado do atualizado.
- O PDF traz a tabela de colunas nomeadas com esses valores, sem texto cortado.
- Linhas sem correspondência na planilha aparecem como "não registrado", sem erro.
