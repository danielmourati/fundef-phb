## Objetivo
No login (`LoginPage.tsx`), desativar/ocultar o toggle "Professor Contratado" e adicionar um badge "Em breve" no tab correspondente, deixando apenas "Professor Efetivo" ativo/visível.

## Alterações
1. **`src/pages/LoginPage.tsx`**: 
   - Ocultar ou desabilitar o `TabsTrigger` de "Professor Contratado".
   - Adicionar badge "Em breve" ao tab (se mantido visível mas desabilitado) ou remover completamente o tab e deixar apenas "Professor Efetivo".

## Critério de aceite
- Tela de login mostra apenas "Professor Efetivo" como opção ativa.
- Nenhum erro de compilação ou runtime.