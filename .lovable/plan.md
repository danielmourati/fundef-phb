# Anexo II obrigatório no fluxo de Contestação

## Objetivo
Espelhar o fluxo do "Reportar Problema" dentro da Contestação do professor: ele baixa o **Anexo II** (mesmo PDF já usado no modal de reportar problema), preenche, e ao abrir contestação anexa esse documento. O arquivo passa a ser visível para **Admin** e **Jurídico** junto da contestação.

## 1. Tela do Professor (DashboardPage)

- Acima do botão "Contestar Dados", adicionar um bloco explicativo com:
  - Texto curto: como contestar exige o Requerimento de Complementação e/ou Retificação de Dados (Anexo II do Edital de Chamamento Público Nº 01/2026), preenchido e assinado.
  - Botão **"Baixar Formulário (Anexo II)"** → faz download de `/anexo-ii-requerimento.pdf` (mesmo arquivo já hospedado).
  - Instrução: "Após preencher, clique em **Contestar Dados** e anexe o documento no formulário."

- No Sheet "Abrir Contestação", adicionar campo obrigatório:
  - **Anexo II preenchido (PDF) ***
  - `<Input type="file" accept="application/pdf">`, validação: obrigatório, apenas PDF, tamanho máx. 10 MB.
  - Mensagem de ajuda: "Envie o Anexo II preenchido e assinado em PDF."
  - Botão "Enviar Contestação" só habilita se arquivo presente.
  - Antes do submit: converter arquivo para base64 e enviar junto com `motivo`, `descricao`, `whatsapp` para `professor-api?action=create_contestacao`.

## 2. Banco de dados (migração não destrutiva)

Adicionar à tabela `contestacoes`:
- `documento_path text` — caminho do arquivo no storage (ex.: `<professor_id>/<contestacao_id>.pdf`).
- `documento_nome text` — nome original opcional.

Nenhuma coluna existente alterada. RLS continua bloqueando acesso direto pelo cliente (acesso só via edge functions com service_role).

Criar bucket de Storage **privado** `contestacao-documentos` (sem políticas para anon/authenticated; acesso só via service_role nas edge functions).

## 3. Edge Functions

**`professor-api`**
- `create_contestacao` (POST): agora aceita também `documento_base64` e `documento_nome`. Valida obrigatoriedade, tipo `application/pdf`, tamanho ≤ 10 MB. Insere a contestação, faz upload do PDF para `contestacao-documentos/<professor_id>/<id>.pdf` via service_role, atualiza a linha com `documento_path` e `documento_nome`.
- `contestacoes` (GET do professor): incluir `documento_path` e `documento_nome` no select; gerar `documento_url` (signed URL ~5 min) para o dono.
- `juridico_contestacoes` (GET): idem, retornar `documento_url` assinada por contestação.

**`admin-api`**
- `contestacoes` (GET): incluir `documento_path`, `documento_nome` e gerar `documento_url` assinada.
- Ao deletar contestação (cascata por professor ou geral): remover também os arquivos no storage para o(s) `documento_path`(s) correspondentes.

## 4. UI Admin e Jurídico
- Nos cards/linhas de contestação (AdminPage aba Contestações e JuridicoPage dialog de detalhe), adicionar link **"Baixar Anexo II enviado"** quando `documento_url` existir, abrindo em nova aba.

## 5. Garantias de não-quebra
- Coluna nova é opcional (nullable) — contestações antigas continuam funcionando, apenas sem link de download.
- Bucket privado e signed URLs evitam exposição pública.
- `mem://` Core rule respeitada: todo acesso a DB e Storage continua via edge functions com service_role; nenhum acesso direto pelo cliente.
- Nenhuma alteração em fluxos de login, mensagens, reportar problema ou admin existentes.

## Detalhes técnicos

```text
DashboardPage
 └─ aba "dados"
     ├─ Card de dados (inalterado)
     ├─ NOVO bloco: explicação + Baixar Anexo II
     └─ Botão "Contestar Dados" (abre Sheet)
         └─ Sheet "Abrir Contestação"
             ├─ Motivo (select)
             ├─ Descrição (textarea)
             ├─ WhatsApp (input)
             ├─ NOVO: Anexo II preenchido (file PDF, obrigatório)
             └─ Enviar
```

Payload do create_contestacao:
```json
{
  "motivo": "...",
  "descricao": "...",
  "whatsapp": "...",
  "documento_nome": "anexo-ii-preenchido.pdf",
  "documento_base64": "JVBERi0xLj..."
}
```
