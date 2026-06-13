## Objetivo

Trocar o modal atual de "Reportar problema" (formulário `AccessReportDialog`) por um modal informativo, com botão para baixar o PDF do Anexo II do Edital e botão para fechar.

## Mudanças

### 1. Adicionar PDF ao projeto

- Salvar `ANEXO II - EDITAL - MINUTA.pdf` em `public/anexo-ii-requerimento.pdf` para que fique acessível diretamente via URL pública e funcione com `<a download>`.

### 2. Novo componente `src/components/AccessReportDialog.tsx` (sobrescrever)

- Manter o mesmo nome/props (`open`, `onOpenChange`) para não quebrar o import existente em `LoginPage.tsx`.
- Conteúdo:
  - Título: "Reportar Problema de Acesso"
  - Texto exatamente como solicitado, incluindo:
    - Parágrafo de introdução sobre o formulário do Anexo II.
    - Lista "Como proceder" (Baixe / Preencha / Envie para `precatorios.parnaiba@edu.parnaiba.pi.gov.br`).
    - Frase final sobre aguardar retorno da equipe jurídica.
  - Botões no rodapé:
    - "Baixar Formulário" — link `<a href="/anexo-ii-requerimento.pdf" download>` estilizado como Button primário.
    - "Fechar" — Button outline que chama `onOpenChange(false)`.

### 3. Não alterar

- `LoginPage.tsx` (já usa `<AccessReportDialog open={reportOpen} onOpenChange={setReportOpen} />`).
- Tabela `access_reports`, edge functions, área `/admin` de reports — ficam intactos (apenas não serão mais alimentados pela página de login). Nada será removido para não quebrar nada.

## Fora de escopo

- Remover a tabela `access_reports` ou a seção do admin. não precisa remover tabela, o que tem lá iremos acessar, faça isso apenas e não vai nada mais completar essa tabela, mas quero ainda ter o acesso do que já foi colocado lá no reports.
- Notificações por e-mail automáticas.