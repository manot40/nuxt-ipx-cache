import type { IncomingHttpHeaders, ServerResponse } from 'node:http';

import { PassThrough } from 'node:stream';
import { basename, extname } from 'node:path';

import { CaptureStream } from '../utils/capture-stream';
import { createIPXCache } from './cache';

import { hash } from 'ohash';
import { sendStream, setHeaders, getHeader } from 'h3';
import { defineNitroPlugin, useRuntimeConfig } from 'nitropack/runtime';

export default defineNitroPlugin((nitroApp) => {
  const { ipxCache: config } = useRuntimeConfig();
  const ipxPrefix = `${config.ipxPrefix}/`;

  const cacheStore = createIPXCache(config.cacheDir, config.maxAge);

  nitroApp.hooks.hook('request', async function (evt) {
    if (!evt.path.startsWith(ipxPrefix)) return;

    const originalRes = evt.node.res;
    const reqUrl = processPath(ipxPrefix, evt.path);

    if (!getHeader(evt, 'cache-control')?.includes('ipx-purge')) {
      /** Load from cache if there is any */
      const cached = await cacheStore.get(reqUrl);
      if (cached) {
        setHeaders(evt, { ...(<HeadersInit>cached.meta), 'cache-status': 'HIT' });
        originalRes.setHeader = (_key, _val) => originalRes;
        return sendStream(evt, cached.data.stream());
      }
    }

    const passThrough = new PassThrough();
    const captureStream = new CaptureStream();
    passThrough.pipe(captureStream);

    const originalWrite = originalRes.write.bind(originalRes) as CustomStream<boolean>;
    const originalEnd = originalRes.end.bind(originalRes) as CustomStream<ServerResponse>;

    originalRes.write = <CustomStream<boolean>>((chunk, encoding, callback) => {
      passThrough.write(chunk, <BufferEncoding>encoding, callback);
      return originalWrite(chunk, <BufferEncoding>encoding, callback);
    });
    originalRes.end = <CustomStream<ServerResponse>>((chunk, encoding, callback) => {
      const expires = new Date(Date.now() + config.maxAge * 1000).toUTCString();
      if (Buffer.isBuffer(chunk)) passThrough.write(chunk, encoding as BufferEncoding, callback);

      if (!originalRes.headersSent) setHeaders(evt, { expires, 'cache-status': 'MISS' });
      originalEnd(chunk, encoding, callback);
      if (originalRes.statusCode !== 200) return originalRes;

      const originHead = originalRes.getHeaders();
      const data = captureStream.getBuffer();
      const meta = {
        etag: originHead['etag'],
        expires,
        'content-type': originHead['content-type'],
        'cache-control': originHead['cache-control'],
        'last-modified': originHead['last-modified'],
        'content-length': data.byteLength.toString(),
      } satisfies IncomingHttpHeaders;

      cacheStore.set(reqUrl, { data, meta });
      return originalRes;
    });
  });
});

function processPath(prefix: string, original = ''): string {
  const [, , params, ...upstream] = original.split('/');
  const parsedParams = params.replaceAll('&', '-');

  const asUrl = new URL(decodeURIComponent(upstream.join('/')), 'http://localhost');
  const pathSplit = asUrl.pathname.split('/');
  const fullFileName = pathSplit.pop() || '';

  const extName = extname(fullFileName);
  let fileName = basename(fullFileName, extName);

  if (asUrl.search) fileName = `${fileName}_${hash(asUrl.search)}`;
  return `${asUrl.hostname}/${pathSplit.join('/')}/${parsedParams}/${fileName}${extName}`;
}

type CustomStream<T> = (
  chunk: unknown,
  encoding?: BufferEncoding | ((error: Error | null | undefined) => void),
  callback?: (error: Error | null | undefined) => void
) => T;
