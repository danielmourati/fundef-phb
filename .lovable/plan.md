# Seletor de vínculo no login: rótulos e contraste

Apenas mudança visual/textual em `src/pages/LoginPage.tsx`. Nenhuma alteração na lógica de login, no estado `tipo` ou na tabela consultada.

## O que muda

1. **Rótulos**: "Professor Efetivo" → **Servidor Efetivo**; "Professor Contratado" → **Servidor Contratado**.
2. **Novo rótulo acima do seletor**: "Selecione o seu vínculo profissional:".
3. **Aba selecionada**: fundo azul principal da identidade (token `primary`), texto branco em negrito e ícone de check (✓) antes do texto.
4. **Aba não selecionada**: fundo cinza claro (`bg-slate-100`) com texto cinza escuro, sem ícone.

## Detalhes técnicos

- Continua usando `Tabs`/`TabsList`/`TabsTrigger` com o mesmo `value={tipo}` e `onValueChange` atual — a variável de estado `tipo` que define a tabela (`efetivo`/`contratado`) permanece intacta.
- Estilos aplicados via classes nos `TabsTrigger`: estado ativo com `data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:font-bold`; inativo com `bg-slate-100 text-slate-600`.
- Ícone `Check` (lucide-react) renderizado apenas na aba ativa (condicional em `tipo`), tamanho pequeno alinhado ao texto.
- Nenhuma mudança em `AuthContext`, `custom-login` ou qualquer regra de acesso.
