# Banner de Consentimento de Cookies (LGPD)

## Objetivo
Exibir um aviso fixo no rodapé informando o uso de cookies, conforme exige a LGPD (Lei 13.709/2018), permitindo ao usuário **Aceitar** ou **Recusar**, e lembrar da escolha entre visitas.

## Comportamento
- Aparece na primeira visita, em todas as páginas (público e autenticado).
- Fica fixo na parte inferior da tela, acima do conteúdo, sem bloquear a navegação.
- Texto curto explicando que o site usa cookies essenciais para autenticação e funcionamento.
- Dois botões: **Aceitar** e **Recusar**.
- Link "Saiba mais" abrindo um modal com a Política de Cookies/Privacidade resumida.
- Após a escolha, o banner desaparece e não reaparece (decisão salva no `localStorage`).
- Possibilidade futura de o usuário revisar a decisão por um link discreto no rodapé ("Preferências de cookies").

## Escopo visual
- Card branco com borda sutil, sombra leve, alinhado ao design system (cores `primary`, `muted`, `border` já existentes).
- Responsivo: empilha texto e botões no mobile.
- Não interfere com as áreas `/admin` e `/dashboard` já existentes (apenas se sobrepõe na base).

## Detalhes técnicos
- Novo componente `src/components/CookieConsent.tsx`.
- Montado uma única vez em `src/App.tsx`, dentro de `BrowserRouter`, fora das rotas.
- Estado persistido em `localStorage` com a chave `cookie-consent` e valores `accepted` | `rejected`.
- Como hoje só usamos cookies/`localStorage` essenciais (token de sessão), recusar **não** desativa funcionalidades — apenas registra a preferência. Se no futuro forem adicionados cookies não essenciais (analytics, etc.), eles deverão checar essa preferência antes de inicializar.
- Sem dependências novas; usa componentes `Button` e `Dialog` do shadcn já presentes.

## Fora de escopo
- Página completa de Política de Privacidade (apenas um resumo no modal por ora).
- Integração com ferramentas de analytics/marketing (não existem hoje no projeto).
