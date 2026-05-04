# Suporte a múltiplas matrículas por CPF

## Decisões confirmadas
- **UX**: seletor de matrículas no topo do painel (abas/dropdown). O card só atualiza ao trocar a matrícula ativa.
- **Vínculo**: contestações e mensagens lidas continuam vinculadas à **matrícula** (linha em `professors`), não ao CPF.
- **Modelo de dados**: mantemos 1 linha por matrícula em `professors` (mesmo CPF repetido). Sem migração de dados.

## Como vai funcionar para o professor

1. Login normal com **CPF + data de nascimento**.
2. Após autenticar, o sistema busca **todas as matrículas** do CPF informado.
3. Comportamento na tela:
   - **1 matrícula** → comportamento atual, sem nenhum seletor.
   - **2 ou mais matrículas** → aparece um **seletor de abas** logo abaixo do nome ("Bem-vindo(a)"), no formato:
     ```text
     [ Matrícula 1000171 ]  [ Matrícula 1000245 ]  [ Matrícula 1000388 ]
     ```
     A primeira fica selecionada por padrão. Ao clicar em outra, todo o card de dados (vínculo, cotas, status, situação do processo) é trocado.
4. As abas **Mensagens** e **Contestações** seguem a matrícula ativa:
   - "Mensagens" mostra os recados daquela matrícula (e o badge de não-lidas considera só ela).
   - "Contestações" lista somente as daquela matrícula, e novas contestações nascem ligadas à matrícula ativa.
5. Botão **Sair** continua único (encerra a sessão inteira).

## Mudanças técnicas

### Backend (`custom-login` edge function)
- Quando o login for de professor, em vez de retornar **um** registro, retornar:
  - dados base do usuário (`nome`, `cpf`, `role`)
  - array `matriculas[]` com cada linha encontrada (`id`, `matricula`, `vinculo_inicio`, `vinculo_fim`, `total_cotas`, `status`)
- O **token HMAC** continua amarrado ao CPF, mas o payload passa a conter a lista de `professor_ids` autorizados, para o `professor-api` validar que a matrícula consultada pertence ao CPF logado.

### Backend (`professor-api`)
- Todas as rotas (`messages`, `mark_read`, `contestacoes`, `create_contestacao`) passam a aceitar um parâmetro `professor_id` (matrícula ativa) no body/query.
- Validação: o `professor_id` recebido **precisa estar** no array de IDs do token. Caso contrário, 403.
- Substituir os `eq("professor_id", user.sub)` pelo `professor_id` recebido.

### Frontend
- `AuthContext`: passa a guardar `professor` (dados base) + `matriculas[]` + `matriculaAtivaId`. Função `setMatriculaAtiva(id)`.
- `DashboardPage`:
  - Renderiza o seletor de abas só se `matriculas.length > 1`.
  - Card de dados, badge de status e stepper passam a ler de `matriculaAtiva` (não mais de `professor` direto).
  - Fetch de mensagens/contestações refeito sempre que `matriculaAtivaId` muda.
- `LoginPage`: nenhuma mudança visual; só consome o novo formato de resposta.

### Banco de dados
- **Nenhuma migração necessária.** A estrutura atual (`professors` com CPF repetido por matrícula) já comporta o cenário.
- Opcional/futuro: índice em `professors(cpf)` para acelerar a busca por múltiplas matrículas (a base é pequena, então não é urgente).

## Fora de escopo
- Tela do admin/jurídico: continua listando uma linha por matrícula (cada vínculo é tratado independentemente, como hoje).
- Unificação de "perfil único" por CPF: não será feita agora, conforme decisão de manter o modelo atual.
