# Relatório PDF das importações (efetivos e contratados)

## Situação atual (verificada)

- Após confirmar uma importação, os dois fluxos abrem um modal de resumo apenas com números: `summaryDialog` em `src/pages/AdminPage.tsx` (efetivos) e `summary` em `src/components/admin/ContratadosView.tsx` (contratados).
- Os detalhes linha a linha existem em memória durante a revisão: cada `ReviewItem` tem `line`, `status` (`valid`, `error`, `dup_file`, `dup_base`, `update`, `nochange`), `reason`, `data` e `diffs` (campo, valor atual, valor novo).
- Hoje esses detalhes são descartados quando o modal de revisão fecha; nada é exportado.

## O que será feito

### 1. Botão "Baixar relatório (PDF)" no modal de resumo
Nos dois fluxos (efetivos e contratados), o modal de resumo ganha um botão que gera e baixa o PDF da importação que acabou de ser executada.

### 2. Conteúdo do relatório

Cabeçalho:
- Título: "Relatório de Importação — Professores Efetivos" ou "— Professores Contratados"
- Data e hora da importação, nome do arquivo, usuário logado
- Rodapé em todas as páginas: numeração e "Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba"

Resumo (mesmos números do modal): total de linhas, válidas, erros, dup. arquivo, dup. base, atualizações, sem alterações, selecionadas, importadas, atualizadas, ignoradas pelo servidor.

Seções detalhadas, na ordem de prioridade pedida:

1. **Linhas atualizadas** — uma entrada por registro com nome, CPF, matrícula e a tabela de alterações:

```text
Linha 42 — MARIA DA SILVA (CPF 000.000.000-00 / Mat. 2878)
  Total de cotas    Atual: 12              Novo: 18
  Cargo             Atual: PROFESSOR EJA   Novo: PROFESSOR(A) EJA
```

2. **Linhas descartadas como duplicadas** — separadas em "Duplicada no arquivo" e "Duplicada na base", com linha, nome, CPF, matrícula e o motivo já calculado (ex.: "1ª ocorrência linha 68").

3. **Linhas com erro** — linha, identificação e motivo.

4. **Linhas sem alterações** e **novos registros inseridos** — listas compactas (linha, nome, CPF, matrícula), para fechar a conferência.

Cada linha marca se foi efetivamente selecionada/enviada ou apenas listada, para que o relatório reflita o que o administrador confirmou.

### 3. Disponibilidade
O relatório é gerado a partir do último resultado de importação em memória (mesma sessão). Se o modal de resumo for fechado, o botão deixa de existir — não haverá histórico persistido no banco nesta etapa.

## Detalhes técnicos

- Adicionar dependência `jspdf` (geração client-side, sem backend).
- Novo arquivo `src/lib/importReportPdf.ts` exportando `generateImportReportPdf({ kind, fileName, user, counts, items, result })`, com quebra de página automática, larguras de coluna fixas e truncagem de textos longos.
- `AdminPage.tsx`: guardar `allItems`, o conjunto de índices selecionados e o nome do arquivo no estado do `summaryDialog` para alimentar o relatório; adicionar o botão no footer do modal.
- `ContratadosView.tsx`: mesma alteração no estado `summary`, reutilizando a função compartilhada (o campo de períodos entra como um diff textual, como já ocorre na revisão).
- Sem mudanças no banco de dados nem nas edge functions.

## Critério de aceite

- Após importar efetivos ou contratados, o modal de resumo oferece o download do PDF.
- O PDF lista todas as linhas atualizadas com Atual → Novo por campo, e todas as descartadas como duplicadas com o motivo.
- Arquivos grandes (centenas de linhas) geram um PDF paginado, sem texto cortado nem sobreposição.
