Objetivo
--------
Exibir um modal informativo antes das telas públicas (home e login) orientando o usuário de que, no primeiro acesso, deve usar o CPF (somente números) tanto no campo "CPF" quanto no campo "Senha", e que a alteração de senha será exigida logo após a autenticação.

Escopo
------
- Apenas frontend/componente de UI; sem alterações no banco, auth ou fluxo de negócio.
- O modal deve aparecer na landing (Index) e na tela de login (LoginPage) para usuários não autenticados.
- O modal não deve reaparecer a cada carregamento: guardar no localStorage a informação de que o usuário já viu o aviso.

Implementação
-------------
1. Criar o componente `src/components/FirstAccessInfoDialog.tsx` usando `AlertDialog` (já existente no projeto) e ícone `Info` do lucide-react.
   - Título: "Primeiro acesso".
   - Corpo: texto explicativo sobre uso do CPF no login e na senha, e sobre a troca obrigatória de senha após o login.
   - Botão único de ação: "Entendi".
   - Estado interno de aberto/fechado baseado em uma chave no localStorage (`fundef_first_access_seen`).

2. Inserir `<FirstAccessInfoDialog />` em `src/pages/LoginPage.tsx` abaixo dos demais dialogs.

3. Inserir `<FirstAccessInfoDialog />` em `src/pages/Index.tsx`, renderizando-o condicionalmente apenas quando `!professor` (para não atrapalhar usuários já logados que serão redirecionados).

4. Reaproveitar os tokens de design existentes (`bg-primary`, `text-primary-foreground`, etc.) sem criar novas classes ad-hoc.

Validação
---------
- Verificar no preview que o modal aparece ao acessar `/login` e `/` sem sessão ativa.
- Confirmar que o texto exibido corresponde às orientações de primeiro acesso.
- Confirmar que o modal fecha ao clicar em "Entendi" e não reaparece ao recarregar a página (localStorage).