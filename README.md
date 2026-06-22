# Le Petit Paradis

## Visual storefront studio

Admins can press **Edit page** on the storefront homepage or open **Admin → Themes** (`/admin/themes`). Both entry points open the same full-screen visual studio with desktop, tablet, and mobile previews.

The studio includes 27 draggable blocks, global colors and spacing, responsive grids, real product feeds, media and editorial blocks, detailed button controls, duplication, visibility, ordering, and section-level layout controls. Clicking a preview section opens its controls immediately.

Choose **Save** to publish the current draft to the storefront. The configuration is cached locally and synchronized through `theme_customizations`, so visitors and other devices receive the published homepage. **Reset** publishes the starter layout.

Run `supabase/migrations/20260622000000_theme_customization.sql` for cloud persistence and `supabase/migrations/20260622130000_secure_theme_customizations.sql` to restrict publishing to storefront administrators. Browser storage under `lpp.visual-theme.v1` remains a fast local cache.

## Development

```bash
npm install
npm run dev
npm run lint
npm run build
```
