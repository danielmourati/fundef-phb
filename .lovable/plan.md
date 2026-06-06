## Permitir 2 vínculos: CPF duplicado com matrícula diferente

Hoje qualquer CPF repetido é marcado como `dup_file`/`dup_base`. Vamos permitir duplo vínculo quando a matrícula for diferente — o par único passa a ser **(cpf + matricula)**.

### Mudanças em `src/pages/AdminPage.tsx` (`handleFileImport`)

Substituir os mapas atuais por chaves compostas e reorganizar a classificação:

- `seenCpfMat: Map<string, number>` → chave `cpf|matricula` (1ª ocorrência no arquivo).
- `seenCpf: Map<string, { line, matricula }>` → para detectar "mesmo CPF, mesma matrícula" vs "mesmo CPF, matrícula diferente".
- `existingByCpf: Map<cpf, Set<matricula>>` construído a partir de `professors`.

Regras por linha (após validações de nome/cpf/total_cotas inalteradas):

1. **dup_file (mesmo cpf+matricula no arquivo)** → `selectable:false` (linha idêntica, backend rejeitaria). Motivo: `"Linha duplicada (cpf+matrícula) — 1ª em Lx"`.
2. **CPF repetido no arquivo, matrícula diferente** → `valid`, com `reason: "2º vínculo (CPF também na linha Lx com matrícula Y)"`. Pré-marcada.
3. **dup_base (cpf+matricula já existe)** → `dup_base`, motivo `"Cadastro já existe (cpf+matrícula)"`, `selectable:true` (admin decide; backend ainda deduplica).
4. **CPF já na base, matrícula nova** → `valid`, reason `"2º vínculo — CPF já cadastrado com matrícula Y"`. Pré-marcada.
5. **Matrícula repetida (arquivo ou base) com CPF diferente** → continua `dup_file`/`dup_base` selecionável (matrícula não deve se repetir entre pessoas distintas, mas deixamos o admin decidir).

### Mudanças no edge function `supabase/functions/admin-api/index.ts` (`import_csv`)

A dedup atual usa apenas `cpfDigits`, o que descarta o 2º vínculo. Trocar para chave composta:

- `seen: Set<string>` com chave `${cpf}|${matricula||''}`.
- Consulta `existing` por `cpf` continua, mas o filtro vira: rejeita apenas quando existir registro com **mesmo cpf E mesma matrícula** (`existing.some(e => e.cpf===p.cpf && (e.matricula||'') === (p.matricula||''))`). Selecionar também `matricula` no `.select()`.
- Mantém contador `skipped`.

### Fora de escopo

- Sem mudanças no `ImportReviewDialog` (já mostra motivo/status existentes).
- Sem mudanças no schema; o campo `matricula` continua opcional. Se a matrícula vier vazia em ambos os registros do mesmo CPF, são tratados como duplicata real (`dup_file`).
- Sem nova UI; o badge "Válida" cobre o caso de 2º vínculo, com motivo explicando.
