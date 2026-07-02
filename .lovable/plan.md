## Objetivo

Deixar o toggle de vínculo (Efetivo/Contratado) impossível de ignorar para o professor leigo, com pista visual automática enquanto nada estiver selecionado.

## Mudanças em `src/pages/LoginPage.tsx`

Aplicar todas as pistas apenas enquanto `tipo === null`. Some assim que o usuário clica.

1. **Rótulo explícito acima das abas** (novo):
   - Texto: **"Passo 1 · Escolha seu tipo de vínculo"** com uma seta (`ArrowDown` do lucide) apontando para as abas.
   - Cor `text-primary`, peso semibold, centralizado.

2. **Halo animado nas abas (`TabsList`)**:
   - Wrapper com `ring-2 ring-primary/60 ring-offset-2 animate-pulse rounded-lg` enquanto `!tipo`. Ao selecionar, ring some suavemente (transition).

3. **Setas pulsantes convergindo para as duas abas**:
   - Ícones `MousePointerClick` (lucide) discretos, um em cada extremidade da `TabsList`, com `animate-bounce` sutil. Removidos após seleção.

4. **Frase de apoio já existente** ("Selecione o tipo de vínculo para continuar") ganha ícone `Info` e cor `text-primary` (hoje é `muted-foreground`).

5. **Foco automático (acessibilidade)**:
   - `useEffect` que dá `focus()` no primeiro `TabsTrigger` no mount quando `!tipo`, então usuários de teclado/leitor de tela também percebem.

6. **Passo 2 implícito**: quando `tipo` estiver preenchido, aparece um pequeno rótulo **"Passo 2 · Informe CPF e senha"** acima do campo CPF, reforçando o fluxo.

## O que NÃO muda

- Lógica de login, validação e roteamento.
- Estrutura de `AuthContext`, edge functions, backend.
- Layout geral da página (imagem lateral, logo, footer).

## Validação

1. Abrir `/login` sem interagir: ver rótulo "Passo 1", halo pulsante nas abas, setas piscando, mensagem em azul.
2. Selecionar qualquer aba: todas as pistas somem; aparece "Passo 2" acima do CPF; campos e botão habilitam.
3. Testar navegação por teclado: `Tab` inicial cai direto no primeiro toggle.
