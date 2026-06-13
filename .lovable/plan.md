## Problema

Na imagem enviada, o modal "Conflitos encontrados na importação" exibe:
- **Total: 1, Válidas: 0, Dup. base: 1**
- Botão final: **"Importar 0 selecionada(s)"** (desabilitado)

Causa: em `handleFileImport` (linhas 553-556 de `src/pages/AdminPage.tsx`), apenas as linhas conflitantes são passadas para o modal — as válidas são separadas em `reviewState.validRows` e mescladas só no `onConfirm`. Resultado: quando o arquivo tem **apenas 1 linha conflitante e nenhuma válida** entre as enviadas ao diálogo, o botão "Importar selecionadas" fica em 0 porque a seleção inicial só marca itens com status `valid` (linhas 42-46 de `ImportReviewDialog.tsx`) — e não há nenhum.

Além disso, o usuário não vê quais linhas foram consideradas válidas, perdendo visibilidade do que será importado.

## Correção (`src/pages/AdminPage.tsx`)

### 1. Passar TODAS as linhas para o modal (válidas + conflitos)
Trocar o bloco das linhas 553-556 por:

```ts
// Abre o modal mostrando todas as linhas (válidas pré-selecionadas + conflitos para revisão).
setReviewState({ open: true, items, validRows: [] });
```

Agora `items` contém o array completo: válidas + duplicadas + erros. O `ImportReviewDialog` já:
- Conta corretamente cada categoria (badges Total/Válidas/Erros/Dup.).
- Pré-seleciona automaticamente as `valid` no `useEffect` (linhas 49-55).
- Habilita o botão "Importar X selecionada(s)" com X ≥ 1.

### 2. Simplificar o `onConfirm` (linhas 1486-1490)
Como agora `rows` já vem com TODAS as linhas selecionadas (válidas + conflitos marcados manualmente), remover a mesclagem com `validRows`:

```ts
onConfirm={async (rows) => {
  setReviewState({ open: false, items: [], validRows: [] });
  await runImport(rows);
}}
```

### 3. (Opcional, mas recomendado) Ajustar título/descrição do modal
Em `ImportReviewDialog.tsx` (linhas 105-108) o título "Conflitos encontrados na importação" fica enganoso quando há válidas. Trocar para:
- Título: `Revisão da importação`
- Descrição: `Linhas válidas já estão selecionadas. Marque também as conflitantes que deseja importar mesmo assim, ou desmarque o que não quiser importar.`

## Fora de escopo
- Sem mudança no edge function.
- Sem mudança na lógica de validação/dedup (apenas no fluxo de exibição).
- Sem mudança no schema.

## Resultado esperado para o arquivo enviado
Modal abre com: **Total: 8, Válidas: 7, Dup. base: 1**, 7 linhas pré-marcadas, botão **"Importar 7 selecionada(s)"** habilitado. Usuário pode opcionalmente marcar a duplicada para forçar importação.