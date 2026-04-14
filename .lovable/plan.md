

# Redesign do Dashboard do Professor

## O que muda

### 1. Card principal — layout inspirado no card de rastreamento
Redesenhar o card de dados do professor seguindo o estilo visual da imagem de referência (card de tracking):
- **Matrícula** em destaque no topo (grande, bold) com **Badge de status** ao lado
- Layout em grid com labels pequenos em cinza e valores em destaque:
  - **Vínculo**: início e fim (lado a lado, estilo "From / To")
  - **Cadastrado em** e **Total de Cotas** (linha abaixo)
- **Barra de progresso visual** com 3 etapas: `Pendente → Em Análise → Validado`, destacando a etapa atual com indicador colorido (inspirado no stepper da imagem)
- CPF formatado abaixo

### 2. Formulário de contestação — oculto, abre em Drawer (canvas)
- Remover o card de contestação da página
- Adicionar um botão **"Contestar Dados"** abaixo do card principal
- Abaixo do botão, um texto explicativo pequeno: _"Caso identifique alguma divergência nos seus dados, clique acima para abrir uma contestação. Nossa equipe jurídica analisará e retornará pelo contato informado."_
- Ao clicar, abre um **Sheet/Drawer** (componente Shadcn `Sheet` lateral) contendo o formulário completo de contestação (motivo, descrição, WhatsApp)

### Arquivo afetado
- `src/pages/DashboardPage.tsx` — reescrita do layout do card e migração do formulário para dentro de um `Sheet`

### Componentes utilizados
- `Sheet` (já existe em `src/components/ui/sheet.tsx`) para o canvas lateral
- Manter todos os componentes existentes (Badge, Card, Button, Select, Input, Textarea, Label)

