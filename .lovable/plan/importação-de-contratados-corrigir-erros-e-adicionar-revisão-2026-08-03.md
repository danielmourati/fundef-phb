# Importação de Contratados: corrigir erros e adicionar revisão/status

Hoje a importação de contratados envia o arquivo inteiro de uma vez e só mostra um aviso curto ("X importado(s)"). Os efetivos já têm tela de revisão linha a linha, badges de status, comparação [Atual] → [Novo] e modal de resumo. Vamos igualar os dois fluxos e corrigir as falhas do arquivo enviado.

## Problemas identificados no arquivo enviado (577 linhas)

1. **Envio em lote único**: todas as linhas vão em uma só chamada, e o servidor gera o hash de senha um por um (bcrypt) antes de inserir. Com 577 linhas isso estoura o tempo limite da função — causa provável do erro relatado. Será confirmado com um teste em lote pequeno antes do ajuste final.
2. **Períodos com formatos não reconhecidos**: o leitor atual só entende "MM/AAAA a MM/AAAA". O arquivo traz também:
   - mês isolado: `07/2002`, `09/2002`, `03/2002`
   - conector "e": `11/2004 e 12/2004`
   - misturas: `05/2004 a 07/2004 e 10/2004`
   - separadores vazios no fim: `...;`
   Hoje esses períodos são silenciosamente descartados.
3. **Sem validação nem visibilidade**: linhas sem nome, cotas não numéricas, CPF com dígitos errados e duplicidades não são reportadas — o usuário não sabe o que entrou e o que ficou de fora.

## O que será feito

### 1. Leitura e validação no navegador
- Conferir se as colunas do arquivo batem com o modelo (nome, matricula, cpf, periodos, carga_horaria, total_cotas, cargo, vinculo) e avisar quais estão faltando ou sobrando.
- Aceitar `;` dentro de campos entre aspas (já funciona) e também `|` como separador de períodos.
- Normalizar CPF (só dígitos), matrícula e campos com traços (`-`, `--`) como vazios.
- Classificar cada linha com um status:
  - **Válida** — novo contratado
  - **Erro** — sem nome, cotas não numéricas, CPF com quantidade de dígitos inválida (CPF vazio continua permitido)
  - **Dup. arquivo** — mesma chave repetida no arquivo (CPF, ou nome+matrícula quando não há CPF)
  - **Atualização** — já existe na base e há campos diferentes, com comparação [Atual] → [Novo] (inclusive lista de períodos)
  - **Sem alterações** — já existe e nada muda

### 2. Tela de revisão antes de importar
Reaproveitar o mesmo componente de revisão dos efetivos: contadores por status, filtro por aba, busca, seleção linha a linha e pré-seleção das linhas válidas e de atualização. A coluna de períodos será exibida já interpretada (ex.: "03/2002–05/2002, 07/2002").

### 3. Importação em blocos com progresso
- Enviar em blocos de 50 linhas, com barra de progresso ("X de Y").
- Ao final, abrir o modal de resumo (mesmo padrão dos efetivos): total de linhas, válidas, erros, duplicadas, atualizadas, sem alterações, selecionadas, ignoradas pelo servidor, importadas e atualizadas.

### 4. Ajustes no servidor (função admin-api)
- **Períodos**: novo interpretador que aceita intervalos com "a"/"até"/"-", meses isolados (fim = início), conector "e" e listas mistas; separadores `;`, `|` e quebras de linha; trechos vazios ignorados.
- **Desempenho**: gerar os hashes de senha em paralelo por bloco (ou reutilizar um hash único quando a senha inicial for a mesma), evitando o estouro de tempo.
- **Nova ação de atualização** (`update_contratados_csv`): atualiza registros existentes sem sobrescrever com campos vazios ou com traços, e substitui a lista de períodos quando o arquivo trouxer períodos.
- Continuar identificando o registro por CPF quando houver, e por nome+matrícula quando o CPF estiver em branco.

## Detalhes técnicos

- `src/components/admin/ContratadosView.tsx`: substituir `handleFile` por pipeline parse → validação/diff → `ImportReviewDialog` → importação em blocos; adicionar estados `reviewState`, `importProgress`, `summaryDialog` espelhando `AdminPage.tsx`.
- Reutilizar `ImportReviewDialog` (`ReviewItem`, `ReviewDiff`) sem alterações estruturais; períodos entram como campo textual no `data`/`diffs`.
- Carregar a base atual para comparação via nova ação `contratados_all` (paginada em blocos de 1000, como `professors_all`).
- `supabase/functions/admin-api/index.ts`: extrair `parsePeriodos()` reutilizável, otimizar hashing em `import_contratados`, adicionar `update_contratados_csv` e `contratados_all`; redeploy da função.
- Sem mudanças de banco de dados.
