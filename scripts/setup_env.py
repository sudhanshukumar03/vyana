"""Create local demo environment files without replacing existing secrets.

Run from the repository root: python scripts/setup_env.py
"""
import secrets
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_env(path):
    if not path.exists():
        return {}
    raw = path.read_bytes()
    encoding = 'utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else ('utf-16-le' if b'\x00' in raw else 'utf-8-sig')
    text = raw.decode(encoding)
    return dict(line.split('=', 1) for line in text.splitlines() if '=' in line and not line.lstrip().startswith('#'))


def write_env(path, values):
    path.write_text('\n'.join(f'{key}={value}' for key, value in values.items()) + '\n', encoding='utf-8')


def main():
    root = read_env(ROOT / '.env')
    ai = read_env(ROOT / 'ai/.env')
    for key in ['JWT_SECRET', 'AI_INTERNAL_SECRET', 'POSTGRES_PASSWORD', 'APP_DB_PASSWORD']:
        if len(root.get(key, '')) < 32:
            root[key] = secrets.token_urlsafe(32)
    root.setdefault('WEB_ORIGIN', 'http://localhost:8080')
    if not root.get('GEMINI_API_KEY'):
        root['GEMINI_API_KEY'] = ai.get('GEMINI_API_KEY', '')
    write_env(ROOT / '.env', root)
    api = read_env(ROOT / 'apps/api/.env')
    api.update({'JWT_SECRET': root['JWT_SECRET'], 'AI_INTERNAL_SECRET': root['AI_INTERNAL_SECRET']})
    api.setdefault('DATABASE_URL', f"postgresql://postgres:{root['POSTGRES_PASSWORD']}@127.0.0.1:5433/healthguard")
    api.setdefault('WEB_ORIGIN', 'http://localhost:5173')
    write_env(ROOT / 'apps/api/.env', api)
    ai['AI_INTERNAL_SECRET'] = root['AI_INTERNAL_SECRET']
    write_env(ROOT / 'ai/.env', ai)
    print('Local environment files prepared. Existing database URLs and Gemini keys were preserved.')


if __name__ == '__main__':
    main()
