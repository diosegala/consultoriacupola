

## Substituir logos na Sidebar

### Alterações

1. Copiar `user-uploads://Logo_cupola_con_H_branca_lima_1.png` para `src/assets/cupola-logo-branca.png`
2. Copiar `user-uploads://icone_cupola_verde-2.png` para `src/assets/cupola-icon.png`

3. **`src/components/layout/Sidebar.tsx`**:
   - Importar as duas novas imagens
   - Sidebar expandida: usar `cupola-logo-branca.png` (logo completa com fonte branca)
   - Sidebar collapsed: usar `cupola-icon.png` (apenas o ícone)

