import {loadSosDeliveryConfig,type SosDeliveryConfig} from './sos-delivery';
import {loadGoogleHealthConfig,type GoogleHealthConfig} from './google-health';

export interface Config {
  databaseUrl: string;
  jwtSecret: string;
  internalSecret: string;
  origin: string;
  aiUrl: string;
  production: boolean;
  publicRegistration: boolean;
  staleSeconds: number;
  port: number;
  sosDelivery: SosDeliveryConfig;
  googleHealth?:GoogleHealthConfig|null;
  googleSyncSeconds:number;
  locationProviders?:{geoapifyKey?:string;ninjasKey?:string};
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const secret = (key: string) => {
    const value = env[key] || '';
    if (value.length < 32 || !/^[!-~]+$/.test(value) || /change.me|your.secret|dev.secret/i.test(value)) {
      throw new Error(`${key} must be a unique configured secret of at least 32 characters`);
    }
    return value;
  };
  if (env.NODE_ENV && !['development','test','production'].includes(env.NODE_ENV)) throw new Error('NODE_ENV must be development, test or production');
  if (env.PUBLIC_REGISTRATION && !['true','false'].includes(env.PUBLIC_REGISTRATION)) throw new Error('PUBLIC_REGISTRATION must be true or false');
  const production = env.NODE_ENV === 'production';
  const origin = env.WEB_ORIGIN || 'http://localhost:5173';
  let parsedOrigin: URL;
  try { parsedOrigin=new URL(origin); } catch { throw new Error('WEB_ORIGIN must be an HTTP(S) origin'); }
  if (!['http:','https:'].includes(parsedOrigin.protocol) || parsedOrigin.origin!==origin || parsedOrigin.username || parsedOrigin.password) throw new Error('WEB_ORIGIN must be an exact HTTP(S) origin without a path or credentials');
  if (production && parsedOrigin.protocol!=='https:') throw new Error('Production WEB_ORIGIN must use HTTPS');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required (local Compose PostgreSQL uses port 5433)');
  let database: URL, ai: URL;
  try { database=new URL(env.DATABASE_URL); } catch { throw new Error('DATABASE_URL must be a PostgreSQL URL'); }
  if (!['postgres:','postgresql:'].includes(database.protocol) || !database.hostname || database.pathname.length<2) throw new Error('DATABASE_URL must name a PostgreSQL host and database');
  try { ai=new URL(env.AI_URL || 'http://127.0.0.1:8001'); } catch { throw new Error('AI_URL must be an HTTP(S) base URL'); }
  if (!['http:','https:'].includes(ai.protocol) || ai.username || ai.password || ai.search || ai.hash) throw new Error('AI_URL must be an HTTP(S) base URL without credentials, query or fragment');
  const staleSeconds=Number(env.STALE_SECONDS||30),port=Number(env.PORT||8000);
  if(!Number.isInteger(staleSeconds)||staleSeconds<10||staleSeconds>3600)throw new Error('STALE_SECONDS must be an integer from 10 to 3600');
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be from 1 to 65535');
  const googleSyncSeconds=Number(env.GOOGLE_HEALTH_SYNC_SECONDS||120);
  if(!Number.isInteger(googleSyncSeconds)||googleSyncSeconds<60||googleSyncSeconds>3600)throw new Error('GOOGLE_HEALTH_SYNC_SECONDS must be from 60 to 3600');
  const jwtSecret=secret('JWT_SECRET'),internalSecret=secret('AI_INTERNAL_SECRET');
  if(jwtSecret===internalSecret)throw new Error('JWT_SECRET and AI_INTERNAL_SECRET must differ');
  return {
    databaseUrl: env.DATABASE_URL, jwtSecret, internalSecret,
    origin, aiUrl: ai.href.replace(/\/$/,''), production,
    publicRegistration: env.PUBLIC_REGISTRATION === 'true',
    staleSeconds, port, googleSyncSeconds,sosDelivery:loadSosDeliveryConfig(env),googleHealth:loadGoogleHealthConfig(env,origin),
    locationProviders:{geoapifyKey:(env.GEOAPIFY_API_KEY||env.GEOAPIFY_KEY)?.trim(),ninjasKey:env.API_NINJAS_KEY?.trim()},
  };
}
