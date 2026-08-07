# Corrigir corte da coluna Data no PDF de Contestações

## Problema
A soma das larguras das colunas do relatório (866 pt) é maior que a área útil da página A4 paisagem (794 pt), então a coluna "Data" fica cortada na borda direita.

## Solução
Ajustar `src/lib/contestacoesPdf.ts` para que a tabela sempre caiba na página, de forma "responsiva":

1. Calcular a largura útil (`pageW - 2 * margem`) em tempo de execução.
2. Definir as colunas por peso proporcional em vez de pontos fixos e escalar todas para preencher exatamente a largura útil.
3. Dar mais espaço a Nome e Descrição, e garantir mínimos legíveis para Matrícula, WhatsApp, Status e Data (data em formato curto dd/mm/aaaa hh:mm quebrando em 2 linhas se preciso).
4. Usar a largura calculada em cabeçalho, faixas zebradas e linhas divisórias, e desenhar as bordas verticais para deixar claro que nada foi cortado.

## Verificação
Gerar o PDF e conferir visualmente que a coluna Data aparece completa e a tabela termina dentro da margem direita.
