import dotenv from 'dotenv';
import path from 'path';

export function loadEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  filename = path.resolve(__dirname, '../.env'),
) {
  // Local dev can inherit the Compose web origin from its parent terminal.
  // The API's own .env describes its host ports and must win in that mode.
  // Deployed processes retain the normal explicit-environment precedence.
  const localDevelopment = Boolean(env.TS_NODE_DEV) && env.NODE_ENV !== 'production';
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) if (value !== undefined) values[key] = value;
  const result = dotenv.config({ path: filename, processEnv: values, override: localDevelopment });
  Object.assign(env, values);
  return result;
}
