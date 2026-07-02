## Objetivo

Adicionar suporte a **Professores Contratados** em paralelo aos efetivos, sem alterar código/comportamento existente. Contratados podem ter **múltiplos períodos de vínculo descontínuos** (MM/AAAA → MM/AAAA).

## Escopo

### 1. Banco de dados (nova migração)

Duas novas tabelas isoladas dos efetivos:

- `public.contratados`
  - `nome`, `cpf` (único), `matricula`, `data_nascimento`, `carga_horaria` (default 20), `total_cotas` (default 0), `cargo` (default 'PROFESSOR(A) EJA'), `vinculo` (`'Contratado' | 'Comissionado'`, default 'Contratado'), `status` (default 'ATIVO'), `senha_hash`, timestamps.
- `public.contratado_periodos`
  - `contratado_id` (FK cascade), `inicio` (MM/AAAA, texto), `fim` (MM/AAAA, texto), `ordem`, timestamps.
  - Índice por `contratado_id`.

RLS habilitado com bloqueio total no cliente (mesmo padrão dos efetivos) — todo acesso via Edge Functions com `service_role`. GRANTs para `service_role`; sem grants para `anon`/`authenticated`.

### 2. Edge Function `admin-api` (estender, não quebrar)

Novos endpoints, mantendo os atuais intactos:

- `GET /contratados` — lista com períodos agregados.
- `POST /contratados` — cria contratado + períodos (transação).
- `PUT /contratados/:id` — atualiza dados + substitui períodos.
- `DELETE /contratados/:id`.
- `POST /contratados/import` — importação em lote (mesma UX do CSV/PDF atual), agrupando múltiplas linhas do mesmo CPF em múltiplos períodos.
- `POST /contratados/clear` — limpar base.
- Reutiliza hashing/senha padrão = CPF (mesma lógica dos efetivos).

Dashboard stats: adicionar `totalContratados` no endpoint de stats existente.

### 3. Edge Function `custom-login` (estender)

Aceitar parâmetro `tipo: 'efetivo' | 'contratado'`.

- `efetivo` (default se ausente) → mantém comportamento atual (tabela `professors`).
- `contratado` → consulta `contratados`. Emite token HMAC com claim `tipo=contratado`, role `professor`.

Mantém rate limiting e `login_attempts` como hoje.

### 4. Frontend

#### 4a. Login (`src/pages/LoginPage.tsx`)

Adicionar toggle **Professor Efetivo | Professor Contratado** (Tabs shadcn) acima do CPF, conforme mockup. Envia `tipo` ao `custom-login`. Sessão armazena `tipo` para futuras chamadas.

`AuthContext`: expor `tipo` na sessão; `login(cpf, senha, tipo)`.

#### 4b. Dashboard Admin (`src/pages/AdminPage.tsx`)

- Sidebar: nova entrada **Contratados** entre Professores e Contestações.
- Dashboard cards: adicionar card **Total Contratados** ao lado de **Total Efetivos** (renomear card atual para "Total Efetivos").
- Nova view "Contratados" — praticamente idêntica à de Professores, com colunas: NOME, MAT, CPF, VÍNCULO (badge), PERÍODOS TRABALHADOS (lista de chips 📅 MM/AAAA → MM/AAAA), CH, COTAS, AÇÕES.
- Botões: Modelo CSV, Importar (CSV/PDF), Limpar Base, + Adicionar.

#### 4c. Modal Adicionar/Editar Contratado

Baseado no modal de efetivos, com diferenças:

- Sem "Data de Admissão"/"Data de Aposentadoria".
- Campo **Vínculo** (select: Contratado/Comissionado).
- Bloco **Períodos Trabalhados** com botão "+ Adicionar período" — cada linha = par de inputs MM/AAAA com máscara `maskMonthYear` + lixeira. Mínimo 1 período.
- Salvar envia array de períodos ao endpoint.

#### 4d. Importação CSV/PDF de contratados

Reusa `ImportReviewDialog` (variante ou prop `mode="contratados"`):

- Parser reconhece coluna **PERÍODO TRABALHADO** com múltiplos períodos separados por `;` (ex.: `07/2005 a 10/2005; 01/2006 a 07/2006`) e converte cada trecho `MM/AAAA a MM/AAAA` em um período.
- Agrupa por CPF: linhas repetidas do mesmo CPF viram períodos adicionais do mesmo contratado.
- Modelo CSV de contratados: cabeçalho `NOME,MAT,CPF,PERIODO_TRABALHADO,CH,COTAS,CARGO,VINCULO` (períodos separados por `;`).

### 5. Não incluído / preservado

- Nenhuma mudança na tabela `professors`, no fluxo de efetivos, nas contestações, mensagens ou reports.
- Nenhuma mudança nos edge functions `professor-api` (contratados terão dashboard próprio numa etapa posterior — este plano cobre apenas login + área admin).

## Detalhes técnicos

```text
contratados (1) ──< contratado_periodos (N)
                       inicio, fim (MM/AAAA)
```

Formato dos períodos armazenado como texto `MM/AAAA` para casar com máscara existente `maskMonthYear`. Ordenação por `ordem` (int) para preservar entrada do usuário.

Todos os endpoints novos ficam sob prefixo `/contratados` no `admin-api` para não conflitar com rotas atuais. Login para contratados usa o mesmo `custom-login` com discriminador `tipo`.

## Pergunta em aberto

1. Área do professor contratado (`/dashboard`): implementar já nesta rodada uma versão básica (ver períodos, cotas, abrir contestação) ou deixar para etapa seguinte? Recomendo **deixar para próxima etapa** para manter esta entrega focada e sem risco ao fluxo atual dos efetivos. Vamos deixar pra próxima etapa então, mas grave na memória já, pois é realmente o próximo passo.