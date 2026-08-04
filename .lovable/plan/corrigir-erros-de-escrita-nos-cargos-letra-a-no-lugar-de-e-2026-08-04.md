# Corrigir erros de escrita nos cargos (letra "a" no lugar de "E")

## O que foi verificado no banco

- Tabela **contratados**, coluna `cargo`: 24 valores distintos, e praticamente todos estão corrompidos com "a" no lugar de "E" (ex.: `DIRaTOR (A)` — 115 registros, `SUPaRVISOR (A)` — 101, `PROFaSSOR (A) - aJA` — 118, `VICa-DIRaTORA` — 5).
- O "a" solto entre dois cargos também é um "E" (conjunção): `DIRaTOR (A) a SUPaRVISOR (A)` = `DIRETOR (A) E SUPERVISOR (A)`.
- Um registro com caixa errada: `sUPaRVISOR (A)` → `SUPERVISOR (A)`.
- Tabela **professors**: cargos estão corretos (`PROFESSOR (A)`), sem o padrão de erro.
- Colunas `nome`, `status`, `vinculo`, `carga_horaria`: nenhum registro com o padrão de troca de letra. Em `vinculo` há apenas diferença de caixa (`contratado` x `Contratado`).

## O que será feito

1. Correção dos cargos de contratados, substituindo "a" por "E" onde é claramente erro de digitação, mantendo a estrutura do texto:
   - `DIRaTOR` → `DIRETOR`, `SUPaRVISOR` → `SUPERVISOR`, `PROFaSSOR` → `PROFESSOR`, `VICa` → `VICE`, `aJA` → `EJA`, `aSCOLAR` → `ESCOLAR`, e o conector ` a ` → ` E `.
2. Padronizar caixa alta no início (`sUPaRVISOR (A)` → `SUPERVISOR (A)`).
3. Normalizar espaços duplicados e espaçamento do hífen para uniformizar variações do mesmo cargo (ex.: `PROFESSOR(A)  - EJA`, `PROFESSOR(A) -  EJA`, `PROFESSOR (A) -EJA` passam a `PROFESSOR(A) - EJA`).
4. Padronizar `vinculo` minúsculo para `Contratado`.

Nenhum outro campo é alterado: nome, CPF, matrícula, cotas, períodos, senhas e status permanecem intactos.

## Detalhes técnicos

- Um único script de atualização de dados sobre `public.contratados`, aplicando `replace`/`regexp_replace` encadeados apenas na coluna `cargo` (e `vinculo` para a caixa), com filtro nas linhas afetadas.
- Como a tabela tem trigger de auditoria (`log_record_changes`) em `cargo`, cada correção fica registrada em `record_changes` como antigo → novo, ficando visível nos relatórios.
- Após a correção, conferência da lista de cargos distintos para garantir que não restou nenhum "a" indevido.

## Critério de aceite

- `select distinct cargo from contratados` não retorna nenhum valor com "a" no meio de palavra em maiúsculas.
- Contagem total de registros permanece 576, sem alteração de nomes ou vínculos além da padronização de caixa.
