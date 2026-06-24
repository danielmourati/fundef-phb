## Contexto
O modal `Reportar Problema de Acesso` possui duas opções: **Anexo II** (correção de dados) e **Anexo III** (inclusão na lista). Atualmente, a opção Anexo II exibe apenas os passos para envio, mas não lista os documentos exigidos. A opção Anexo III já possui essa lista.

## Objetivo
Incluir a seção **Documentos exigidos** na opção **Anexo II**, com a mesma estrutura visual e itens da opção Anexo III.

## Alteração
- **Arquivo:** `src/components/AccessReportDialog.tsx`
- **Seção afetada:** `option === 'anexo-ii'`
- **Mudança:** Adicionar, após o parágrafo introdutório e antes da seção "Como enviar", um bloco `<div>` com:
  - Título: `Documentos exigidos:`
  - Lista não ordenada (`<ul>`) com os mesmos 6 itens presentes na opção Anexo III:
    - RG e CPF
    - Número do PIS/PASEP/NIT
    - Comprovante de residência
    - Dados bancários do Banco do Brasil (agência e conta)
    - Certidão de casamento (se houver)
    - Documentos que comprovem o vínculo de trabalho no período de julho de 2001 a dezembro de 2006

## Fora de escopo
- Nenhuma alteração na opção Anexo III
- Nenhuma alteração no fluxo de envio ou e-mail
- Nenhuma mudança de estilo além da replicação do padrão existente