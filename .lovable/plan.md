## Objetivo

Obrigar a escolha explícita do tipo de vínculo (Efetivo ou Contratado) antes que o usuário digite CPF/senha, evitando login no tipo errado por padrão.

## Mudanças em `src/pages/LoginPage.tsx`

1. **Estado inicial sem seleção**: `tipo` passa de `'efetivo' | 'contratado'` para `'efetivo' | 'contratado' | null`, começando em `null`. Nenhuma aba fica pré-selecionada.
2. **Aba visual sem default**: `Tabs` recebe `value={tipo ?? ''}`. Ambos os `TabsTrigger` aparecem inativos até o clique.
3. **Bloqueio dos campos**: enquanto `tipo === null`:
   - `Input` de CPF e senha ficam `disabled`, com `placeholder` adaptado ("Selecione o tipo de vínculo acima").
   - Botão **Entrar** fica `disabled`.
   - Mostrar uma linha discreta abaixo das abas: "Selecione o tipo de vínculo para continuar." (some após seleção).
4. **Guarda no submit**: `handleSubmit` valida `if (!tipo) { setError('Selecione o tipo de vínculo.'); return; }` antes de chamar `login`.
5. **Reset ao trocar tipo**: ao alternar entre Efetivo/Contratado depois de já ter digitado, limpar `error` (mantém CPF/senha para não frustrar).

## O que NÃO muda

- `AuthContext.login`, edge functions, roteamento pós-login e visual geral da página.
- Fluxos administrativos e de dashboard.

## Validação

1. Abrir `/login`: nenhuma aba destacada, campos desabilitados, botão desabilitado.
2. Clicar em "Professor Efetivo" ou "Professor Contratado": campos habilitam, aba fica ativa.
3. Tentar submit sem escolher (via teclado): mensagem "Selecione o tipo de vínculo."
4. Login normal continua funcionando para ambos os tipos.
