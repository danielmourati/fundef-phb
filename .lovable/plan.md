# Relatório PDF das importações + guia de histórico

## Situação atual (verificada)

- Após confirmar uma importação, os dois fluxos abrem apenas um modal de resumo com números: `summaryDialog` em `src/pages/AdminPage.tsx` (efetivos) e `summary` em `src/components/admin/ContratadosView.tsx` (contratados).
- Os detalhes linha a linha existem só em memória durante a revisão: cada `ReviewItem` tem `line`, `status` (`valid`, `error`, `dup_file`, `dup_base`, `update`, `nochange`), `reason`, `data` e `diffs` (campo, valor atual, valor novo). Tudo é descartado ao fechar o modal.
- Não existe tabela de histórico de importações no banco.

## O que será feito

### 1. Registrar cada importação no banco
Nova tabela `import_logs` gravada pela função `admin-api` no fim de cada importação, com:
- tipo (efetivo / contratado), nome do arquivo, data/hora, quem executou
- contadores do resumo (total, válidas, erros, dup. arquivo, dup. base, atualizações, sem alterações, selecionadas, importadas, atualizadas, ignoradas)
- o detalhamento linha a linha em JSON (linha, status, motivo, nome, CPF, matrícula e as diferenças Atual → Novo)

Acesso somente por edge function (mesmo padrão de segurança do projeto: RLS bloqueia o cliente).

### 2. Relatório em PDF
Botão "Baixar relatório (PDF)" tanto no modal de resumo (imediatamente após importar) quanto na nova guia de histórico.

Conteúdo do PDF:
- Cabeçalho: "Relatório de Importação — Professores Efetivos" (ou "— Contratados"), data/hora, arquivo, usuário; rodapé com paginação e "Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba".
- Resumo com todos os contadores.
- **Linhas atualizadas** (seção principal), com o comparativo por campo:

```text
Linha 42 — MARIA DA SILVA (CPF 000.000.000-00 / Mat. 2878)
  Total de cotas    Atual: 12              Novo: 18
  Cargo             Atual: PROFESSOR EJA   Novo: PROFESSOR(A) EJA
```

- **Linhas descartadas como duplicadas**, separadas em "Duplicada no arquivo" e "Duplicada na base", com linha, identificação e motivo (ex.: "1ª ocorrência linha 68").
- **Linhas com erro** com o motivo.
- **Sem alterações** e **novos registros inseridos** em listas compactas.
- Marcação de quais linhas foram efetivamente enviadas x apenas listadas.

### 3. Nova guia "Relatórios de Importação" no menu do admin
- Item no menu lateral e no menu mobile.
- Tabela com: data/hora, tipo (Efetivo/Contratado), arquivo, usuário, importadas, atualizadas, duplicadas, erros e ações.
- Filtros por tipo e por período, busca por arquivo/usuário e paginação no servidor (mesmo padrão já usado nas outras listas).
- Ações por registro: **Ver detalhes** (modal com as linhas atualizadas e duplicadas) e **Baixar PDF** (gerado no momento do clique a partir do detalhamento salvo).

## Detalhes técnicos

- Migração: `CREATE TABLE public.import_logs` (id, tipo, file_name, executed_by, executed_by_name, counts jsonb, items jsonb, created_at) + GRANT para `service_role`, RLS habilitada com política restritiva `deny_all_client_access` para `anon`/`authenticated`, seguindo o padrão das demais tabelas. Índice por `created_at desc` e por `tipo`.
- `supabase/functions/admin-api/index.ts`: nova ação `log_import` (grava o registro), `import_logs` (lista paginada com filtros) e `import_log` (detalhe por id). As ações de importação existentes não mudam de contrato; o log é gravado em uma chamada separada no fim do fluxo, junto do resumo já calculado no cliente.
- Nova dependência `jspdf`; novo `src/lib/importReportPdf.ts` com `generateImportReportPdf({ kind, fileName, user, createdAt, counts, items })`, quebra de página automática, colunas fixas e truncagem de textos longos.
- `src/pages/AdminPage.tsx`: enviar `log_import` após a importação de efetivos, guardar itens/arquivo no estado do resumo e adicionar o botão de PDF; registrar a nova guia no menu e no roteamento interno de views.
- `src/components/admin/ContratadosView.tsx`: mesma gravação de log e botão de PDF, reutilizando a função compartilhada.
- Novo `src/components/admin/ImportLogsView.tsx` com a lista, filtros, modal de detalhes e download.

## Critério de aceite

- Toda importação (efetivos ou contratados) passa a ficar registrada e aparece na nova guia.
- O PDF lista as linhas atualizadas com Atual → Novo por campo e as descartadas como duplicadas com o motivo.
- O download funciona tanto logo após importar quanto dias depois pela guia de histórico.
- Arquivos grandes geram PDF paginado, sem texto cortado ou sobreposto.
