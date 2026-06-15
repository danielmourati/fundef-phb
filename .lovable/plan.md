Ajustar a coluna do formulário de login (lado direito) para que todo o conteúdo caiba sem corte no viewport de desktop padrão (1366x768, zoom 100%), eliminando a barra de rolagem e o corte do logo.

### Problema
A coluna direita contém logo, título, divisor, formulário, botão de reportar e footer. O conjunto excede a altura disponível em telas de 768 px, fazendo o logo ficar cortado pela metade quando o formulário é centralizado verticalmente.

### Alterações propostas em `src/pages/LoginPage.tsx`

1. **Logo**
   - Reduzir altura de `h-16` (64 px) para `h-12` (48 px).
   - Manter `w-auto max-w-full object-contain` para preservar proporção.

2. **Título e subtítulo**
   - Reduzir título de `text-2xl` para `text-xl`.
   - Reduzir margem do subtítulo (`mt-1` mantido, mas com menos espaço no `space-y` pai).

3. **Espaçamento vertical**
   - Reduzir `space-y-8` entre logo/divisor/formulário para `space-y-6`.
   - Reduzir `space-y-5` dentro do formulário para `space-y-4`.

4. **Inputs e botão**
   - Reduzir altura dos inputs de `h-12` (48 px) para `h-11` (44 px).
   - Reduzir altura do botão principal para `h-11`.

5. **Footer**
   - Reduzir `mt-12` para `mt-8`.

6. **Layout vertical**
   - Manter `justify-start lg:justify-center` (já ajustado) e `overflow-y-auto` como fallback, mas a meta é que o conteúdo não precise rolar em 768 px.

### Validação
- Verificar via screenshot do preview em 1366x768 que o logo aparece completo e não há barra de rolagem visível na coluna direita.
- Testar em 1024x768 para garantir que, se ainda precisar rolar, o conteúdo comece no topo e não fique cortado.

### Arquivos alterados
- `src/pages/LoginPage.tsx`