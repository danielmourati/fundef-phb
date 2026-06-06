## Modal de Divergências da Importação

Substituir o atual `window.confirm` (linha 404-414 de `src/pages/AdminPage.tsx`) por um **Dialog** com checkboxes para o admin selecionar quais registros importar.

### Fluxo

1. Usuário escolhe arquivo CSV/PDF.
2. `handleFileImport` faz o parse e roda a validação atual (nome, CPF, total_cotas, duplicidade no arquivo, duplicidade na base).
3. Em vez de `confirm()`, abre o **modal de divergências** com todas as linhas (válidas + problemáticas), permitindo selecionar manualmente o que importar.
4. Ao confirmar, segue o envio em chunks atual para `import_csv`.

### Estrutura do Modal

Componente novo: `src/components/ImportReviewDialog.tsx`.

Cabeçalho com resumo:

- Total de linhas / Válidas / Erros / Duplicadas no arquivo / Já na base.

Barra de ações:

- Filtro por categoria (Todas | Válidas | Erros | Dup. arquivo | Dup. base).
- Busca por nome/CPF/matrícula.
- Botões: "Selecionar todas válidas", "Selecionar tudo", "Limpar seleção".
- Contador "X selecionada(s) de N".

Tabela com scroll (`ScrollArea`, max-h ~60vh):

```text
[ ✓ ] Linha | Status     | Nome              | CPF         | Matrícula | Motivo
[ ✓ ] 2     | Válida     | João Silva        | 123...      | 1001      | —
[   ] 13    | Dup arquivo| Maria Souza       | 456...      | 1002      | CPF repetido L14
[   ] 174   | Erro       | Carlos            | 999 (9 dig) | 1003      | CPF inválido
[   ] 22    | Dup base   | Ana Lima          | 321...      | 1004      | CPF já existe
```

Regras de seleção:

- Linhas válidas vêm pré-marcadas.
- Linhas com erro de dado (CPF inválido, nome ausente, total_cotas inválido) **ficam desabilitadas** (não podem ser marcadas; o backend rejeitaria).
- Linhas duplicadas no arquivo ou na base podem ser marcadas manualmente pelo admin (o backend ainda fará dedupe final por CPF; ficará registrado no toast).

Rodapé:

- `Cancelar` | `Importar N selecionada(s)` (botão primário, desabilita se N=0).

### Mudanças em `src/pages/AdminPage.tsx`

- Novo state: `reviewState: { open, items, summary } | null`, onde `items` é o array com `{ line, status: 'valid'|'error'|'dup_file'|'dup_base', reason, data, selectable, selected }`.
- `handleFileImport` para após popular `items` e abre o modal; não envia diretamente.
- Lógica de chunked POST atual é extraída para `runImport(rows)` e chamada pelo `onConfirm` do modal.
- Remove o `window.confirm` e o bloco preview de erro.

### Fora de escopo

- Sem modo "atualizar/upsert".
- Sem alteração no edge function `admin-api/import_csv`; ele continua deduplicando por CPF como rede de segurança final.
- Sem mudanças no template CSV nem nas colunas aceitas (`nome, matricula, cpf, vinculo_inicio, vinculo_fim, total_cotas, status`).

### Componentes shadcn usados

`Dialog`, `Checkbox`, `Table`, `ScrollArea`, `Button`, `Input` (busca), `Badge` (status), `Tabs` (filtros).  
  
`Exibir Status (Ativo, Aposentada, Exonerada etc) no card de inoformações do professor na sua própria área de visualização.`