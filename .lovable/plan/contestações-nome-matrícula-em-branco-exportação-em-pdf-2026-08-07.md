# Contestações: nome/matrícula em branco + exportação em PDF

## Causa identificada (verificada no banco)

Das 66 contestações, 47 vêm de servidores efetivos e 19 de servidores contratados — todas têm autor vinculado, nenhum registro órfão.

O problema é no backend: a listagem de contestações só busca o autor na tabela de professores efetivos. Para as 19 contestações de contratados, o nome/matrícula nunca é buscado, então as colunas aparecem vazias. Na sua imagem, as primeiras linhas (mais recentes) são justamente de contratados.

Observação: 5 dos contratados que contestaram realmente não têm matrícula cadastrada no banco (o dado veio em branco na planilha de origem). Para esses, o nome será exibido normalmente e a matrícula mostrará "—" (não vou inventar número). Os outros 14 têm matrícula e passarão a aparecer.

## O que será feito

1. **Backend (listagem de contestações)**: buscar o autor também na base de contratados e devolver, para cada contestação, `nome`, `matricula` e o `vinculo` (Efetivo / Contratado).
2. **Tabela do admin**: usar esses campos unificados, exibir "—" quando faltar dado, e acrescentar a coluna **Vínculo** para diferenciar efetivo de contratado.
3. **Exportar CSV**: passar a incluir nome, matrícula e vínculo corretos de todos (efetivos e contratados).
4. **Exportar PDF**: novo botão ao lado do CSV, gerando um relatório A4 paisagem com cabeçalho (título, data/hora, total), tabela com Protocolo, Matrícula, Nome, Vínculo, Motivo, Descrição, WhatsApp, Status e Data, paginação e o rodapé padrão "Desenvolvido pelo Núcleo de Tecnologia e Dados - SEDUC Parnaíba".

## Detalhes técnicos

- `supabase/functions/admin-api/index.ts`, ação `GET contestacoes`: além do lookup em `professors`, fazer lookup em `contratados` pelos `contratado_id` e retornar `autor: { nome, matricula, vinculo }` mantendo `professors` por compatibilidade.
- `src/pages/AdminPage.tsx`: atualizar a interface `Contestacao`, as células da tabela, `exportContestacoes` e adicionar `exportContestacoesPdf`.
- PDF via `jspdf` (já usado no projeto), em novo arquivo `src/lib/contestacoesPdf.ts` seguindo o padrão de `src/lib/importReportPdf.ts`.
- Nenhuma alteração de schema nem de dados é necessária.  
  
certo, as contestações contém anexos, então cuidado com a forma que vai mostrar eles no csv e pdf. De resto, ok.