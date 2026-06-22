# Le Petit Paradis

## Visual theme builder

Open **Admin → Themes** (`/admin/themes`) to customize the storefront with an instant preview. The editor supports global colors, type and spacing scales, header/card/background styles, full button styling, and ordered section-based content. Sections can be added, hidden, reordered, duplicated, edited, or deleted.

Choose **Save** to publish the current draft to this browser. The saved configuration is loaded on app start and replaces the legacy homepage with the customized section renderer. Choose **Reset** to remove the saved configuration and restore the original homepage and default design.

The scalable config contract is in `src/theme-customizer/types.ts`; defaults and section factories are in `src/theme-customizer/defaults.ts`. To add a section type, extend `SectionType`, add its default copy/catalog entry, add its rendering branch in `ThemeRenderer.tsx`, and expose any specialized controls in `ThemeEditor.tsx`.

Persistence currently uses `localStorage` under `lpp.visual-theme.v1`, so the feature works without database changes. `supabase/migrations/20260622000000_theme_customization.sql` is an optional, non-destructive schema for future cross-device persistence; review its write policy before manually applying it in Supabase.

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```
