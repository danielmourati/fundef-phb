# Recuperar as importações de hoje nos Relatórios de Importação

## Situação atual (verificada)

- A tabela de histórico `import_logs` está **vazia** — nenhum registro, nem de hoje.
- Ainda assim, o banco mostra atividade de importação hoje (03/08/2026):
  - Professores efetivos: 17 registros criados e 69 atualizados hoje (total 1.133).
  - Professores contratados: 576 registros criados/atualizados hoje (total 576).
- Conclusão: as importações de hoje foram executadas antes/sem o registro do histórico ter sido gravado, então a aba "Relatórios de Importação" não tem nada para listar.

## O que será feito

1. **Reconstruir o histórico de hoje** a partir dos próprios dados já gravados:
   - Nova ação no backend (`backfill_import_logs`) que agrupa os registros de `professors` e `contratados` por janela de tempo (blocos de execução do mesmo dia) e cria um registro em `import_logs` para cada bloco, com:
     - tipo (efetivos / contratados);
     - data e hora da execução;
     - contagem de inseridos e atualizados;
     - lista das linhas (nome, CPF, matrícula) marcadas como "Inserida" ou "Atualizada".
   - Limitação honesta: linhas **descartadas como duplicadas** e o nome do arquivo original não existem no banco, portanto os relatórios reconstruídos virão sem essas informações (marcados como "Histórico reconstruído").
2. **Executar o backfill** para hoje, para que os relatórios apareçam imediatamente na aba.
3. **Garantir o registro futuro**: revisar a chamada de gravação do histórico nos dois fluxos de importação (efetivos e contratados) para que ela ocorra sempre no fim da execução, com log de erro visível caso falhe — evitando que novas importações fiquem sem relatório.
4. Os relatórios reconstruídos ficam consultáveis e com download em PDF na aba "Relatórios de Importação", igual aos demais.

## Detalhes técnicos

- Backend: `supabase/functions/admin-api/index.ts` — nova ação POST `backfill_import_logs` (somente admin), agrupando por `date_trunc('minute', created_at/updated_at)` com tolerância de alguns minutos para formar cada lote; grava em `import_logs` com `counts` e `items` no mesmo formato usado hoje pelo PDF.
- Frontend: `src/components/admin/ImportLogsView.tsx` — badge "Reconstruído" quando o log não tem `file_name`; nenhuma mudança no gerador de PDF (`src/lib/importReportPdf.ts`) além de tolerar ausência de duplicadas.
- `src/lib/importLog.ts` — passar a propagar/registrar falhas de gravação em vez de silenciá-las.
