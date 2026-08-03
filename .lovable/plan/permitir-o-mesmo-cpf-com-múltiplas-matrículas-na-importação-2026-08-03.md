# Permitir o mesmo CPF com múltiplas matrículas na importação de contratados

Hoje a importação marca como **Dup. arquivo** (sem possibilidade de seleção) qualquer linha que repita o CPF, mesmo quando a matrícula é diferente. No exemplo enviado, as linhas 68 e 69 são da mesma pessoa com matrículas 2878 e 25733 — dois vínculos legítimos — e a segunda fica bloqueada.

## O que muda

### 1. Chave de identificação passa a incluir a matrícula
- Duplicidade dentro do arquivo só é apontada quando **CPF e matrícula** são iguais (ou nome + matrícula, quando não há CPF).
- Mesmo CPF com matrículas diferentes → linhas independentes, classificadas normalmente como **Válida** (novo vínculo) ou **Atualização**.

### 2. Comparação com a base também por CPF + matrícula
- O registro existente é localizado por CPF **e** matrícula. Assim, um novo vínculo do mesmo CPF entra como novo cadastro em vez de sobrescrever o vínculo antigo.
- Quando o arquivo traz CPF sem matrícula e existe apenas um cadastro com aquele CPF, ele continua sendo tratado como atualização desse cadastro.

### 3. Linhas duplicadas passam a ser selecionáveis
- Linhas com status **Dup. arquivo** (mesmo CPF + mesma matrícula) ganham caixa de seleção habilitada, desmarcada por padrão, para o caso de o admin querer importar mesmo assim. O motivo continua visível na linha.

## Detalhes técnicos

- `src/components/admin/ContratadosView.tsx`
  - `key` de dedupe: `cpf:<cpf>|<matricula>` (ou `nm:<nome>|<matricula>` sem CPF).
  - Mapa da base: `byCpfMat` (cpf+matrícula) com fallback para `byCpf` único quando a linha não traz matrícula; mantém `byNameMat`.
  - Item `dup_file` passa a `selectable: true` (fora da pré-seleção, que segue só `valid` + `update`).
- `supabase/functions/admin-api/index.ts`
  - `import_contratados`: agrupamento por `cpf + matricula` (mantendo agrupamento de períodos da mesma matrícula).
  - `update_contratados_csv`: filtro por `cpf` **e** `matricula` quando ambos vierem; sem matrícula, mantém o comportamento atual.
  - Redeploy da função.
- Sem alterações de banco (não há restrição de unicidade em `contratados.cpf`) e o login já lida com múltiplos vínculos do mesmo CPF.
