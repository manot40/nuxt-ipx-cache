# Nuxt IPX Cache

[![npm version][npm-version-src]][npm-version-href]
[![npm downloads][npm-downloads-src]][npm-downloads-href]
[![License][license-src]][license-href]
[![Nuxt][nuxt-src]][nuxt-href]

Cache IPX-optimized images to disk and save your CPU time!

- [✨ &nbsp;Release Notes](/CHANGELOG.md)
- [🔗 &nbsp;Repository](https://github.com/manot40/nuxt-ipx-cache)

## Features

- **Local Caching**: Stores IPX-transformed images on disk to reduce CPU usage on repeated requests.
- **Automatic Cache Management**: Handles cache expiration and cleanup based on configurable TTL.
- **Seamless Integration**: Leverage existing Nuxt's official `@nuxt/image` module.
- **Configurable**: Customize cache directory, max age, and IPX prefix.

## Quick Setup

Install the module to your Nuxt application with one command:

```bash
npx nuxi module add nuxt-ipx-cache
```

The module will automatically start caching IPX-transformed images.

## Configuration

You can configure the module in your `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  modules: ['nuxt-ipx-cache'],
  ipxCache: {
    // Max cache age in seconds before getting deleted from disk (default: 86400 - 1 day)
    maxAge: 86400,
    // Image cache location relative to process.cwd() (default: '.cache/ipx')
    cacheDir: '.cache/ipx',
    // IPX handler endpoint (default: '/_ipx')
    ipxPrefix: '/_ipx',
  },
});
```

## How It Works

This module inspired by [this issue](https://github.com/nuxt/image/issues/1400). Intercepts IPX requests and caches the transformed images locally. On subsequent requests for the same transformation, it serves the image from the cache instead of re-processing it, significantly reducing CPU load.

- Images are cached with their metadata (headers like etag, content-type, etc.).
- Cache entries expire based on the `maxAge` setting.
- Supports purging cache by adding `cache-control: ipx-purge` header to the request.

<!-- Badges -->

[npm-version-src]: https://img.shields.io/npm/v/nuxt-ipx-cache/latest.svg?style=flat&colorA=020420&colorB=00DC82
[npm-version-href]: https://npmjs.com/package/nuxt-ipx-cache
[npm-downloads-src]: https://img.shields.io/npm/dm/nuxt-ipx-cache.svg?style=flat&colorA=020420&colorB=00DC82
[npm-downloads-href]: https://npm.chart.dev/nuxt-ipx-cache
[license-src]: https://img.shields.io/npm/l/nuxt-ipx-cache.svg?style=flat&colorA=020420&colorB=00DC82
[license-href]: https://npmjs.com/package/nuxt-ipx-cache
[nuxt-src]: https://img.shields.io/badge/Nuxt-020420?logo=nuxt.js
[nuxt-href]: https://nuxt.com
