"""Create local demo environment files without replacing existing secrets.

Run from the repository root: python scripts/setup_env.py
"""
import secrets
import re
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]


def read_env(path, dialect='python'):
    if not path.exists():
        return {}
    raw = path.read_bytes()
    encoding = 'utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else ('utf-16-le' if b'\x00' in raw else 'utf-8-sig')
    text = raw.decode(encoding)
    values = {}
    for line in text.splitlines():
        line = line.strip()
        if line.startswith('export '):
            line = line[7:].lstrip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        key, value = key.strip(), value.strip()
        if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_]*', key):
            continue
        delimiters = ("'", '"', '`') if dialect == 'node' else ("'", '"')
        if value.startswith(delimiters):
            delimiter = value[0]
            match = re.match(r"^(['\"`])((?:\\.|(?!\1).)*)\1(?:\s*#.*)?$", value)
            if not match:
                raise ValueError(f'{path.name}: invalid quoted value for {key}')
            value = match[2]
            if dialect == 'node':
                if delimiter == '"':
                    value = value.replace(r'\n', '\n').replace(r'\r', '\r')
            elif dialect == 'compose':
                if delimiter == "'":
                    value = value.replace(r"\'", "'")
                else:
                    value = re.sub(r'\\([\\"])', lambda m: m[1], value)
            elif delimiter == '"':
                escapes = {'a': '\a', 'b': '\b', 'f': '\f', 'n': '\n', 'r': '\r', 't': '\t', 'v': '\v'}
                value = re.sub(r"""\\([\\'"abfnrtv])""", lambda m: escapes.get(m[1], m[1]), value)
            else:
                value = re.sub(r"\\([\\'])", lambda m: m[1], value)
        else:
            value = value.split('#', 1)[0].rstrip()
        values[key] = value
    return values


def render_env(values, dialect='python'):
    def encode(value):
        if '\n' in value or '\r' in value:
            raise ValueError('Environment values must be on one line')
        if re.fullmatch(r'[A-Za-z0-9_./:@%+=,?&-]*', value):
            return value
        if dialect == 'node':
            for delimiter in ("'", '`', '"'):
                if delimiter not in value and (delimiter != '"' or not re.search(r'\\[nr]', value)):
                    return delimiter + value + delimiter
            raise ValueError('An environment value cannot be quoted consistently for Node; existing files preserved')
        if dialect == 'compose':
            return "'" + value.replace("'", "\\'") + "'"
        return "'" + value.replace('\\', '\\\\').replace("'", "\\'") + "'"
    return '\n'.join(f'{key}={encode(value)}' for key, value in values.items()) + '\n'


def write_env(path, values, dialect='python'):
    path.write_text(render_env(values, dialect), encoding='utf-8')


def main():
    root = read_env(ROOT / '.env', 'compose')
    api = read_env(ROOT / 'apps/api/.env', 'node')
    ai = read_env(ROOT / 'ai/.env')
    for key, environments in [('JWT_SECRET', [root, api]), ('AI_INTERNAL_SECRET', [root, api, ai])]:
        existing = {env[key] for env in environments if env.get(key)}
        if len(existing) > 1:
            raise ValueError(f'{key} differs between environment files; reconcile it before setup')
        value = next(iter(existing)) if existing else secrets.token_urlsafe(32)
        if len(value) < 32 or not all('!' <= c <= '~' for c in value) or re.search(r'change.me|your.secret|dev.secret', value, re.I):
            raise ValueError(f'{key} must be at least 32 ASCII characters without whitespace; existing value preserved')
        root[key] = value
    if root['JWT_SECRET'] == root['AI_INTERNAL_SECRET']:
        raise ValueError('JWT_SECRET and AI_INTERNAL_SECRET must differ; existing files preserved')
    for key in ['POSTGRES_PASSWORD', 'APP_DB_PASSWORD']:
        if not root.get(key):
            root[key] = secrets.token_urlsafe(32)
    for key, default in [('WEB_PORT', '8080'), ('API_PORT', '8000'), ('DB_PORT', '5433')]:
        value = root.get(key) or default
        if not value.isdecimal() or not 1 <= int(value) <= 65535:
            raise ValueError(f'{key} must be a port from 1 to 65535')
        root[key] = value
    root['WEB_ORIGIN'] = root.get('WEB_ORIGIN') or f"http://localhost:{root['WEB_PORT']}"
    root['COMPOSE_DATABASE_URL'] = f"postgresql://healthguard_app:{quote(root['APP_DB_PASSWORD'], safe='')}@db:5432/healthguard"
    root['COMPOSE_MIGRATION_DATABASE_URL'] = f"postgresql://postgres:{quote(root['POSTGRES_PASSWORD'], safe='')}@db:5432/healthguard"
    if not root.get('GEMINI_API_KEY'):
        root['GEMINI_API_KEY'] = ai.get('GEMINI_API_KEY', '')
    root['GEMINI_MODEL'] = root.get('GEMINI_MODEL') or ai.get('GEMINI_MODEL') or 'gemini-2.5-flash'
    ai['GEMINI_MODEL'] = ai.get('GEMINI_MODEL') or root['GEMINI_MODEL']
    api.update({'JWT_SECRET': root['JWT_SECRET'], 'AI_INTERNAL_SECRET': root['AI_INTERNAL_SECRET']})
    if not api.get('DATABASE_URL'):
        api['DATABASE_URL'] = f"postgresql://healthguard_app:{quote(root['APP_DB_PASSWORD'], safe='')}@127.0.0.1:{root['DB_PORT']}/healthguard"
        api['MIGRATION_DATABASE_URL'] = f"postgresql://postgres:{quote(root['POSTGRES_PASSWORD'], safe='')}@127.0.0.1:{root['DB_PORT']}/healthguard"
    api['WEB_ORIGIN'] = api.get('WEB_ORIGIN') or 'http://localhost:5173'
    api['AI_URL'] = api.get('AI_URL') or 'http://127.0.0.1:8001'
    ai['AI_INTERNAL_SECRET'] = root['AI_INTERNAL_SECRET']
    rendered = [(ROOT / '.env', render_env(root, 'compose')),
                (ROOT / 'apps/api/.env', render_env(api, 'node')),
                (ROOT / 'ai/.env', render_env(ai))]
    for path, text in rendered:
        path.write_text(text, encoding='utf-8')
    print(f"Local environment prepared. Compose web origin: {root['WEB_ORIGIN']}")
    print('Existing database URLs, passwords and provider keys were preserved. Run python scripts/check_config.py before startup.')


if __name__ == '__main__':
    main()
