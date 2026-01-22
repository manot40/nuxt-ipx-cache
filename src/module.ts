import defu from 'defu';

import { addServerImports, addServerPlugin, createResolver, defineNuxtModule } from '@nuxt/kit';

export interface ModuleOptions {
  /** Max cache age in seconds before getting deleted from disk. (default 1 day) */
  maxAge?: number;
  /** Image cache location relative to `process.cwd()`. (defaults to `.cache/ipx`) */
  cacheDir?: string;
  /** IPX handler endpoint, leave blank to use `@nuxt/image` default: `/_ipx/*` */
  ipxPrefix?: string;
}

export default defineNuxtModule<ModuleOptions>({
  meta: {
    name: 'ipx-cache',
    configKey: 'ipxCache',
    compatibility: { nuxt: '^3.x || ^4.x' },
  },

  defaults: {
    maxAge: 60 * 60 * 24,
    cacheDir: '.cache/ipx',
    ipxPrefix: '/_ipx',
  },

  async setup(opts, nuxt) {
    const { resolve } = createResolver(import.meta.url);

    const config = nuxt.options.runtimeConfig;
    config.ipxCache = defu((config.ipxCache ??= <typeof config.ipxCache>{ ...opts }), opts);

    nuxt.options.routeRules = <typeof nuxt.options.routeRules>defu(nuxt.options.routeRules, {
      [`${opts.ipxPrefix}/**`]: {
        swr: false,
        cache: false,
        headers: { 'cache-control': `public, max-age=${opts.maxAge}, no-transform` },
      },
    });

    addServerPlugin(resolve('./runtime/server/plugin'));
    addServerImports([{ name: 'createIPXCache', from: resolve('./runtime/server/cache') }]);
  },
});
