# Atualizar dados de professores efetivos na importação (sem sobrescrever cegamente)

## Situação atual (verificada)

- Na importação, linhas cujo par CPF + matrícula já existe na base são marcadas como `dup_base` e apenas ignoradas: o endpoint `import_csv` filtra esses pares e faz somente `insert`. Nada é atualizado.
- O modal de revisão (`ImportReviewDialog`) mostra só os valores do arquivo, sem comparação com o que está no banco.

## O que será feito

### 1. Comparação linha a linha antes de importar
Para cada linha `dup_base` (mesmo CPF + matrícula), comparar campo a campo com o registro existente e marcar quais mudaram: nome, matrícula, data de admissão, data de aposentadoria, carga horária, total de cotas, cargo, status, data de nascimento.

Regras:
- Campo vazio no arquivo **não** apaga o dado atual (é ignorado na comparação).
- Se nenhum campo mudou, a linha aparece como "Sem alterações" e vem desmarcada.
- Se houver mudanças, a linha aparece como "Atualização" e vem pré-marcada.

### 2. Badges "Atual" x "Novo" no modal
Nas linhas duplicadas, exibir por campo alterado uma linha comparativa:

```text
Total de cotas   [Atual] 12  ->  [Novo] 18
Cargo            [Atual] PROFESSOR EJA  ->  [Novo] PROFESSOR(A) EJA
```

Novos badges na legenda e no filtro: "Atualização" e "Sem alterações", mantendo os já existentes (Válida, Erro, Dup. arquivo, Dup. base).

### 3. Atualização real no backend
Ao confirmar, as linhas de atualização selecionadas são enviadas em um fluxo próprio que faz `update` por CPF + matrícula, aplicando **apenas os campos alterados e não vazios**. Nunca altera senha, `role`, `id` ou datas de criação.

### 4. Resumo final
O modal de resumo passa a mostrar também: registros atualizados e registros sem alteração, além dos números atuais (importados, ignorados, erros, duplicados).

## Detalhes técnicos

- `supabase/functions/admin-api/index.ts`: nova ação `POST update_professors_csv` — recebe `rows` com `cpf`, `matricula` e os campos a atualizar; normaliza datas com o mesmo `normalizeDateBR`; atualiza por `eq(cpf)` + `eq(matricula)`; retorna `updated` e `not_found`. `import_csv` permanece inalterado.
- `src/components/ImportReviewDialog.tsx`: `ReviewStatus` ganha `update` e `nochange`; `ReviewItem` ganha `diffs?: { field: string; label: string; current: string; incoming: string }[]`; render do diff com badges dentro da linha da tabela.
- `src/pages/AdminPage.tsx`: em `handleFileImport`, guardar o registro existente completo (já buscado via `professors_all`) e computar `diffs`; `runImport` passa a separar linhas de insert e de update, chamando as duas ações em chunks e somando os totais no `summaryDialog`.

## Critério de aceite

- Reimportar o mesmo arquivo com um campo alterado abre o modal com badge "Atualização" e o comparativo Atual -> Novo.
- Confirmar atualiza os registros existentes sem duplicar e sem apagar campos ausentes no arquivo.
- Linhas idênticas ficam como "Sem alterações" e não geram escrita.
- Fluxo de inserção de novos professores e o de contratados seguem funcionando como hoje.
