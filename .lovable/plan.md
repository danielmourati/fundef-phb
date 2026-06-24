# Refatorar Modal "Reportar Problema de Acesso"

## Objetivo
Transformar o modal atual de relatório de problema em um modal com duas opções distintas: **Anexo II** (dados incorretos/incompletos) e **Anexo III** (nome não consta na lista), cada uma com instruções específicas e botão de download do formulário correspondente.

---

## Pré-requisito
⚠️ **Upload do PDF do Anexo III necessário.** O usuário deve fazer upload do arquivo `anexo-iii-requerimento.pdf` para que eu o coloque em `public/anexo-iii-requerimento.pdf`. Sem isso, o botão de download do Anexo III ficará como placeholder.

---

## Implementação

### 1. Atualizar `src/components/AccessReportDialog.tsx`

Substituir o conteúdo único atual por uma interface com **seleção de opção**:

```text
+--------------------------------------------------+
|  Reportar Problema de Acesso                [X]  |
+--------------------------------------------------+
|                                                    |
|  [ O ] Seus dados estão incorretos ou           |
|        incompletos                                |
|                                                    |
|  [ O ] Você trabalhou no período contemplado,   |
|        mas seu nome não aparece na lista          |
+--------------------------------------------------+
```

**Ao selecionar a Opção 1 (Anexo II):**
- Texto explicativo sobre o Requerimento de Complementação e/ou Retificação de Dados
- Seção "Como enviar" com passos 1-4
- Seção "Após o envio" com instrução de aguardar
- Botão **"↓ BAIXAR FORMULÁRIO – ANEXO II"** (link para `/anexo-ii-requerimento.pdf`)

**Ao selecionar a Opção 2 (Anexo III):**
- Texto explicativo sobre o Requerimento de Inclusão de Interessado não constante na Lista Preliminar
- Seção "Documentos exigidos" com lista de bullets:
  - RG e CPF
  - Número do PIS/PASEP/NIT
  - Comprovante de residência
  - Dados bancários do Banco do Brasil (agência e conta)
  - Certidão de casamento (se houver)
  - Documentos que comprovem o vínculo de trabalho no período de julho de 2001 a dezembro de 2006
- Seção "Como enviar" com passos 1-4
- Seção "Após o envio" com instrução de aguardar
- Botão **"↓ BAIXAR FORMULÁRIO – ANEXO III"** (link para `/anexo-iii-requerimento.pdf`)

### 2. Adicionar PDF do Anexo III

Copiar o arquivo PDF do Anexo III enviado pelo usuário para `public/anexo-iii-requerimento.pdf`.

### 3. Estilos

- Usar o design system existente do projeto (navy blue `#1d4ed8`, tipografia do projeto)
- Radio buttons estilizados para seleção da opção
- Layout com scroll interno (`max-h-[90vh] overflow-y-auto`)
- Botão primário para download, outline para fechar

---

## Fora do escopo
- Geração do PDF do Anexo III (o usuário fornecerá o arquivo)
- Alterações na página de login (apenas o conteúdo do modal muda)

## Arquivos alterados
- `src/components/AccessReportDialog.tsx`
- `public/anexo-iii-requerimento.pdf` (novo)