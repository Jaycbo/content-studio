import {readPlatformTrends} from '../platform-trends.mjs';
import {readRadarFeed} from '../radar-feed.mjs';
import { hijackAndDraft } from '../draft-brief.mjs';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectRadar } from '../../lib/radar-ingestion.mjs';
import { saveRadarCache } from '../radar-cache.mjs';
import { createScraperProvider, demoRadar } from './radar-provider.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const pulsePath = path.join(projectRoot, 'public/studio/data/latest-pulse.json');
const quoteShell = value => "'" + value.replaceAll("'", "'\\''") + "'";

function pulseVersion() {
  try {
    const stat = fs.statSync(pulsePath, { bigint: true });
    return `${stat.ino}:${stat.mtimeNs}:${stat.ctimeNs}:${stat.size}`;
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

export function radarDevPlugin() {
  let busy = false;

  return {
    name: 'luxeva-free-local-radar',
    apply: 'serve',
    enforce: 'pre',

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const send = (data, status = 200) => {
          const body = JSON.stringify(data);
          res.statusCode = status;
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.end(body);
        };

        const urlPath = req.url?.split('?')[0];
        if (!['/api/radar', '/api/synthesis', '/api/hijack', '/api/radar/feed'].includes(urlPath)) {
          return next();
        }

        const peer = req.socket.remoteAddress || '';
        const host = req.headers.host || '';

        // Browsers omit Origin on same-origin GETs. Accept that read only
        // with browser Fetch Metadata AND a matching referrer origin.
        let sameOriginRead = false;
        if (urlPath === '/api/synthesis' && req.method === 'GET' &&
            !req.headers.origin && req.headers['sec-fetch-site'] === 'same-origin') {
          try {
            sameOriginRead = new URL(req.headers.referer).origin === 'http://' + host;
          } catch { /* Missing or invalid referrers remain denied. */ }
        }

        if (
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(peer) ||
          !/^((127\.0\.0\.1|localhost)(:\d+)?|\[::1\](:\d+)?)$/.test(host) ||
          (req.headers.origin !== 'http://' + host && !sameOriginRead) ||
          req.headers['x-luxeva-request'] !== 'radar'
        ) {
          return send(
            { error: 'Run local Radar from this computer’s Studio page.' },
            403,
          );
        }

        if (urlPath === '/api/synthesis') {
          if (!['GET', 'POST'].includes(req.method)) {
            res.setHeader('Allow', 'GET, POST');
            return send({ error: 'Use GET or POST.' }, 405);
          }

          if (req.method === 'GET') {
            try {
              return send(JSON.parse(fs.readFileSync(pulsePath, 'utf8')));
            } catch (error) {
              const missing = error.code === 'ENOENT';
              return send(
                {
                  error: missing
                    ? 'No synthesis data found.'
                    : 'Could not read valid synthesis JSON.',
                },
                missing ? 404 : 500,
              );
            }
          }

          if (busy) {
            return send(
              {
                error:
                  'A Radar operation is already running. Wait for its result.',
              },
              409,
            );
          }

          busy = true;
          try {
            let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)return send({error:'Request too large.'},413);}
            const input=raw?JSON.parse(raw):{};
            if(input.targets!==undefined&&(!Array.isArray(input.targets)||input.targets.length>75||input.targets.some(t=>!t||!/^@?[\w.]+$/.test(t.handle)||![1,2,'agency','niche'].includes(t.tier))))return send({error:'Invalid synthesis targets.'},400);
            if(Array.isArray(input.targets)&&!input.targets.length)return send({error:'Add a target before synthesis.'},400);
            const previousVersion = pulseVersion();

            execSync(
              `${quoteShell(process.execPath)} scripts/radar-synthesis.mjs`,
              {
                cwd: projectRoot,
                env:{...process.env,...(input.targets?{RADAR_TARGETS_JSON:JSON.stringify(input.targets)}:{})},
                stdio: 'inherit',
                timeout: 120_000,
              },
            );

            const generatedVersion = pulseVersion();
            if (
              generatedVersion === null ||
              generatedVersion === previousVersion
            ) {
              return send(
                {
                  error:
                    'Synthesis did not generate a new pulse file. Check the server log.',
                },
                500,
              );
            }

            return send(JSON.parse(fs.readFileSync(pulsePath, 'utf8')));
          } catch {
            return send(
              {
                error:
                  'Synthesis failed or produced invalid JSON. Check the server log.',
              },
              500,
            );
          } finally {
            busy = false;
          }
        }

        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          return send({ error: 'Use POST.' }, 405);
        }

        if (busy) {
          return send(
            {
              error:
                'A Radar operation is already running. Wait for its result.',
            },
            409,
          );
        }

        busy = true;
        try {
          let raw = '';
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 20000) {
              return send({ error: 'Request too large.' }, 413);
            }
          }

          const input = JSON.parse(raw);
          if (!input || typeof input !== 'object' || Array.isArray(input)) {
            return send({ error: 'Expected a JSON object.' }, 400);
          }

          if (urlPath === '/api/radar/feed') return send(await readRadarFeed(input.targets));

          if (urlPath === '/api/hijack') {
            return send(await hijackAndDraft(input.url, {provider:createScraperProvider()}));
          }

          if (input.demo === true) {
            return send(demoRadar());
          }

          const provider = createScraperProvider();
          const result=await collectRadar(input,{provider});
          if(!input.url){try{const saved=saveRadarCache(result);console.log(`[radar] cache: ${saved.added} real outliers saved (${saved.total} total)`);}catch(error){console.error('[radar] could not save radar-cache.json:',error.message);}}
          return send({...result,sources:result.sources.map(source=>({...source,platformTrends:readPlatformTrends()}))});
        } catch (error) {
          return send(
            {
              error:
                error instanceof Error ? error.message : 'Radar scan failed.',
            },
            400,
          );
        } finally {
          busy = false;
        }
      });
    },
  };
}
