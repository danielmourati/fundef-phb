## Problema

O CSV de contratados usa `;` como separador de colunas, mas o mesmo `;` está sendo usado dentro da célula `periodos` para separar múltiplos intervalos (`07/2005 a 10/2005;01/2006 a 07/2006`). O parser de CSV atual quebra essa célula em duas colunas, corrompendo a linha inteira. O backend (`admin-api`) já sabe interpretar múltiplos períodos separados por `;` — o problema está no transporte via CSV.

## Solução

Trocar o separador de períodos no arquivo CSV para `|` (pipe), que não conflita com o formato CSV. O `;` continua funcionando quando os dados vierem de outras fontes (PDF, colagem, JSON), preservando compatibilidade.

Regra final de parsing de períodos (backend):
- `07/2005 a 10/2005 | 01/2006 a 07/2006` → 2 períodos
- `07/2005 a 10/2005 ; 01/2006 a 07/2006` → 2 períodos (mantido)
- `08/2005 a 12/2006` → 1 período
- Quebras de linha dentro da célula também separam períodos (mantido)

## Mudanças

### `src/components/admin/ContratadosView.tsx`
- **Template CSV (`downloadTemplate`)**: trocar o separador de períodos de `;` para `|` nos exemplos:
  - `07/2005 a 10/2005 | 01/2006 a 07/2006`
  - `08/2005 a 12/2006` (inalterado — período único)
- **Cabeçalho do template**: adicionar uma linha de instrução como comentário na primeira linha do arquivo? Não — manter simples: apenas atualizar os exemplos, o próprio exemplo documenta o formato.

### `supabase/functions/admin-api/index.ts` (ação `import_contratados`)
- Ampliar o regex de split de `[;\n]` para `[;|\n]`, aceitando pipe como separador adicional. Mantém retrocompatibilidade com `;` para dados colados manualmente.
- Nenhuma outra lógica muda: agrupamento por CPF, dedup e inserção em `contratado_periodos` seguem iguais.

### `ImportReviewDialog` (se usado no fluxo de contratados)
- Verificar se o preview aplica o mesmo split; se sim, aplicar a mesma extensão de regex. Se ele delega ao backend, nada muda.

## O que NÃO muda

- Estrutura das tabelas `contratados` e `contratado_periodos`.
- Modal manual de adicionar/editar (já usa campos separados de `inicio`/`fim`).
- Fluxo de efetivos, login, dashboard, contestações.
- Formato exibido na UI (chips `MM/AAAA → MM/AAAA`).

## Validação

1. Baixar novo template CSV → confirmar exemplo com `|`.
2. Importar CSV com linha `... | ...` → 2 períodos criados.
3. Importar CSV com período único → 1 período criado.
4. Importar CSV antigo (usando `;` dentro de aspas, se houver) → continua funcionando pelo fallback do regex.
