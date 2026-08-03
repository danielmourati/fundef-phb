# Liberar o login do Professor Contratado

## O que já existe (conferido agora)

Sim, o login de contratado já foi construído junto com o módulo de contratados e continua no código:

- **Backend `custom-login`**: já aceita `tipo: "contratado"`, busca na tabela **contratados** por CPF (com fallback por matrícula), valida senha bcrypt, permite primeiro acesso com CPF (ou data de nascimento) enquanto `senha_definida` for falso, marca `requires_password_change`, anexa os **períodos trabalhados** (`contratado_periodos`) e assina o token com a claim `tipo: "contratado"`.
- **Backend `professor-api`**: já roteia tudo pela claim `tipo` — perfil, contestações, mensagens e troca de senha gravam em `contratados`/`contratado_id`.
- **Dashboard**: `DashboardPage` já detecta `tipo === 'contratado'` e mostra os períodos em chips (coluna "Período Trabalhado Contemplado") em vez de vínculo início/fim.
- **Login**: a aba "Professor Contratado" existe, mas foi **desativada de propósito** com badge "Em breve" (`TabsTrigger disabled`), porque na época os dados ainda não estavam no banco.

Ou seja: falta essencialmente destravar a aba e cobrir dois pontos reais dos dados já importados.

## Situação dos dados (576 contratados no banco)

- 527 com CPF válido (11 dígitos) → login normal por CPF.
- 49 **sem CPF** (em branco ou "-") → não conseguem entrar por CPF; todos têm matrícula.
- 0 registros sem CPF **e** sem matrícula.
- 485 CPFs distintos em 576 linhas → o mesmo CPF pode ter **mais de uma matrícula**.
- `data_nascimento` está vazia em todos → o primeiro acesso só pode ser pelo CPF (ou matrícula, para quem não tem CPF).

## O que será feito

1. **Ativar a aba "Professor Contratado"** no login: remover `disabled`, o badge "Em breve" e o estilo esmaecido; a aba passa a alternar o campo de identificação e o texto de ajuda.
2. **Campo de identificação por aba**: na aba Contratado, o rótulo passa a ser "CPF ou Matrícula" (aceita letras/dígitos), com a nota "No primeiro acesso, a senha é o seu CPF; se você não tem CPF cadastrado, use a sua matrícula como senha." Efetivo continua igual (CPF, somente números).
3. **Primeiro acesso sem CPF**: no `custom-login`, para contratados, além de CPF, aceitar a **matrícula** como senha de bootstrap quando o registro não tiver CPF e ainda não tiver senha definida — e marcar `requires_password_change`, forçando a troca imediata (fluxo de troca já existe e já grava em `contratados`).
4. **Múltiplas matrículas do contratado**: passar a devolver o array `matriculas` também para contratados (hoje só é montado para efetivos), com token por matrícula e os períodos de cada uma, para que o seletor de matrícula do dashboard funcione igual ao do efetivo.
5. **Conferência ponta a ponta** com contas reais de teste: login por CPF, login por matrícula (registro sem CPF), troca de senha obrigatória, exibição dos períodos, troca de matrícula, contestação e mensagens — validando também que efetivo/admin/jurídico continuam intactos.

## Detalhes técnicos

- `src/pages/LoginPage.tsx`: `TabsTrigger value="contratado"` habilitado; rótulo/placeholder/`inputMode` condicionais ao `tipo`; texto de senha padrão condicional. Sem mudança de lógica de auth (o `login(cpf, senha, tipo)` já envia o tipo).
- `supabase/functions/custom-login/index.ts` (bloco `tipoRaw === "contratado"`): bootstrap adicional `onlyDigits(cpf)` vazio → comparar `senha` normalizada com `matricula`; e criar `matriculas` para `sourceTipo === "contratado"` buscando todas as linhas com o mesmo CPF (quando houver CPF), assinando token por linha e anexando seus `contratado_periodos`. Redeploy da função.
- `src/contexts/AuthContext.tsx`: ao trocar de matrícula/definir a ativa, preservar `tipo` e `periodos` do item selecionado (hoje esses campos são descartados na reconstrução do objeto), senão o dashboard do contratado perde os períodos.
- Nada de mudança de schema; nenhuma alteração no dashboard do contratado além do que a preservação de `tipo`/`periodos` já resolve.
