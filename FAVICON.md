# 🎨 Favicon & PWA Icons

## Generated Icons

All favicon sizes have been generated from `public/assets/favicon.svg`:

### Standard Favicons

- `favicon-16x16.png` - Browser tabs (small)
- `favicon-32x32.png` - Browser tabs (standard)
- `favicon-48x48.png` - Browser tabs (large)

### Apple Touch Icons

- `apple-touch-icon.png` (180x180) - iOS home screen

### Android/PWA Icons

- `android-chrome-192x192.png` - Android home screen
- `android-chrome-512x512.png` - Android splash screen

## Files

- `public/index.html` - Contains all favicon links
- `public/manifest.json` - PWA manifest with icon definitions
- `public/browserconfig.xml` - Windows tile configuration
- `scripts/generateFavicons.sh` - Script to regenerate PNG icons from SVG

## Regenerating Icons

If you update `favicon.svg`, regenerate PNG versions:

```bash
./scripts/generateFavicons.sh
```

### Requirements

One of the following:

- **ImageMagick**: `brew install imagemagick`
- **librsvg**: `brew install librsvg`

### Alternative

Use online tools:

- https://realfavicongenerator.net/
- https://favicon.io/

## PWA Features

The app includes PWA (Progressive Web App) features:

### Meta Tags

- Theme color: `#1a1a2e`
- Apple mobile web app capable
- Viewport optimized for mobile

### Manifest

- Name: "Duy Brothers - Billiards"
- Display: standalone
- Orientation: portrait
- Icons for all sizes

### Add to Home Screen

Users can add the app to their home screen:

**iOS:**

1. Open in Safari
2. Tap Share button
3. Select "Add to Home Screen"

**Android:**

1. Open in Chrome
2. Tap menu (⋮)
3. Select "Add to Home screen"

## Browser Support

### Favicon Support

- ✅ Modern browsers: SVG + PNG fallback
- ✅ iOS Safari: Apple Touch Icon
- ✅ Android Chrome: Manifest icons
- ✅ Windows: Tile configuration

### Icon Sizes

- 16x16 - IE, Chrome tabs
- 32x32 - Standard favicon
- 48x48 - Windows site tile
- 180x180 - iOS Safari
- 192x192 - Android Chrome
- 512x512 - Android splash screen

## Testing

### Desktop

- Check browser tab icon
- Check bookmark icon

### Mobile

- Add to home screen
- Check home screen icon
- Check splash screen (Android)

### PWA

- Open in Chrome DevTools
- Go to Application tab
- Check Manifest section
- Verify all icons load correctly

## Notes

- SVG favicon is preferred for modern browsers (vector, scalable)
- PNG versions provide fallback for older browsers
- All PNGs have transparent backgrounds
- Icons use consistent branding (Duy Brothers logo)
- Manifest supports both light and dark themes
