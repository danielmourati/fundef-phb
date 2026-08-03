# Conector "a" reconhecido como intervalo (início → fim)

Objetivo: garantir que textos como `11/2002 a 12/2002` sejam lidos como **um período** com início 11/2002 e fim 12/2002 — nunca como dois meses separados nem descartados.

## Situação atual (verificada no código)

O interpretador de períodos existe em dois lugares (front e servidor) e já aceita `a`, `até`, `ate`, `-`, `–`, `—`. Ainda assim há lacunas que fazem alguns intervalos com "a" não serem reconhecidos:

- O conector com acento **`à`** (`11/2002 à 12/2002`) não está na lista e cai no caso "mês isolado", registrando apenas 11/2002.
- Variações de espaçamento invisível (espaço não separável, tabulação, espaços duplos) não são normalizadas antes da leitura.
- O texto é quebrado por `e` e `,` **antes** de procurar o intervalo, então um separador dentro do trecho pode cortar o par início/fim.
- Não há checagem de ordem: se vier `12/2002 a 11/2002`, grava invertido.

Nada foi importado ainda na base de períodos, então o ajuste vale para todas as próximas importações.

## O que será feito

1. **Normalizar o texto antes de interpretar**: converter espaços especiais em espaço simples, colapsar espaços repetidos e aceitar `à` / `As` / `ate` / `até` / `a` / `-` / `–` / `—` / `→` como conector de intervalo.
2. **Procurar o intervalo primeiro**: em cada trecho, tentar casar o par `MM/AAAA <conector> MM/AAAA` antes de quebrar por `e` / `,`, evitando que o par seja partido.
3. **Corrigir ordem invertida**: quando o fim for anterior ao início, trocar os dois.
4. **Exibir de forma clara**: na tela de revisão e na lista de períodos, mostrar `11/2002 a 12/2002` (em vez de `11/2002–12/2002`), e mês isolado como `07/2002`.
5. Aplicar a mesma regra nas duas pontas para que a pré-visualização coincida exatamente com o que é gravado.

## Detalhes técnicos

- `supabase/functions/admin-api/index.ts`: reescrever `parsePeriodos()` (normalização, regex de intervalo com prioridade, swap de ordem); redeploy da função.
- `src/components/admin/ContratadosView.tsx`: espelhar a lógica em `parsePeriodosClient()` e ajustar `fmtPeriodos()` para usar " a ".
- Sem mudanças de banco de dados.
