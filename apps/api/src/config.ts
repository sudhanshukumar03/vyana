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
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const secret = (key: string) => {
    const value = env[key] || '';
    if (value.length < 32 || /change.me|your.secret|dev.secret/i.test(value)) {
      throw new Error(`${key} must be a unique configured secret of at least 32 characters`);
    }
    return value;
  };
  const production = env.NODE_ENV === 'production';
  const origin = env.WEB_ORIGIN || 'http://localhost:5173';
  if (production && !origin.startsWith('https://')) throw new Error('Production WEB_ORIGIN must use HTTPS');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL is required (local Compose PostgreSQL uses port 5433)');
  const staleSeconds=Number(env.STALE_SECONDS||30),port=Number(env.PORT||8000);
  if(!Number.isInteger(staleSeconds)||staleSeconds<10||staleSeconds>3600)throw new Error('STALE_SECONDS must be an integer from 10 to 3600');
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be from 1 to 65535');
  const jwtSecret=secret('JWT_SECRET'),internalSecret=secret('AI_INTERNAL_SECRET');
  if(jwtSecret===internalSecret)throw new Error('JWT_SECRET and AI_INTERNAL_SECRET must differ');
  return {
    databaseUrl: env.DATABASE_URL, jwtSecret, internalSecret,
    origin, aiUrl: env.AI_URL || 'http://127.0.0.1:8001', production,
    publicRegistration: env.PUBLIC_REGISTRATION === 'true',
    staleSeconds, port,
  };
}
