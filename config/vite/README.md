# Vite Configuration Modules

This directory contains the modularized Vite configuration for the BSKY project. The configuration has been split into separate modules to reduce churn in the main `vite.config.ts` file.

## Structure

### `plugins.ts`
Contains custom Vite plugins:
- **deferCssPlugin**: Defers non-critical CSS loading using the media="print" trick
- **bundleAnalyzerPlugin**: Generates bundle analysis reports (when `ANALYZE=true`)

**When to edit**: Adding new custom plugins, modifying plugin behavior, or adjusting transform logic.

### `chunking.ts`
Defines the manual chunking strategy for code splitting:
- **getManualChunk**: Determines which vendor chunk each module belongs to
- **optimizeModulePreload**: Filters modulepreload for optimal initial load

**When to edit**: Adjusting vendor chunk splitting, adding new vendor packages, or optimizing the bundle structure.

### `build.ts`
Production build configuration:
- Build targets and optimization settings
- Rollup options
- Chunk size limits

**When to edit**: Changing build targets, adjusting chunk size warnings, or modifying build optimization settings.

### `server.ts`
Development and preview server configuration:
- **securityHeaders**: Required headers for FFmpeg/SharedArrayBuffer support
- **proxyConfig**: CORS proxies for external services (Bluesky CDN, OAuth, API)
- **serverConfig**: Dev server settings (port, HMR, file watching)
- **previewConfig**: Production preview server settings

**When to edit**: Adding/modifying proxies, changing dev server settings, or adjusting security headers.

## Benefits of This Structure

1. **Reduced Churn**: Changes to specific areas (plugins, chunking, server config) don't affect the main config file
2. **Better Organization**: Related concerns are grouped together
3. **Easier Testing**: Individual modules can be tested and modified independently
4. **Clear Ownership**: Each file has a clear purpose and can be owned by different concerns
5. **Documentation**: Each module can document its specific domain knowledge

## Making Changes

### Adding a New Proxy
Edit `server.ts` and add to the `proxyConfig` object.

### Adjusting Chunk Strategy
Edit `chunking.ts` and modify the `getManualChunk` function.

### Adding a New Plugin
Edit `plugins.ts` to add your custom plugin, then import and add it to the plugins array in `vite.config.ts`.

### Changing Build Settings
Edit `build.ts` to adjust targets, limits, or Rollup options.

## Migration Notes

This structure was created to address high churn in `vite.config.ts`. Previous changes likely included:
- Adjusting vendor chunk splitting for optimization
- Adding/modifying proxies for external services
- Tweaking plugin behavior
- Experimenting with build settings

All of these can now be done in isolated files, reducing the frequency of changes to the main configuration file.
