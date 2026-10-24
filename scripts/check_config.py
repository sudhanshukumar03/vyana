"""Check local configuration without displaying credentials or changing services."""
import argparse
import json
import re
from pathlib import Path
from urllib.error import URLError
from urllib.parse import unquote, urlsplit
from urllib.request import urlopen

from setup_env import read_env

ROOT = Path(__file__).resolve().parents[1]


def inspect(root=ROOT, services=False):
    errors, warnings = [], []
    environments = {}
    for name in ['.env', 'apps/api/.env', 'ai/.env']:
        path = root / name
        if not path.exists():
            errors.append(f'{name} is missing; run python scripts/setup_env.py')
        environments[name] = read_env(path, 'compose' if name == '.env' else 'node' if name == 'apps/api/.env' else 'python')
    compose, api, ai = (environments[name] for name in ['.env', 'apps/api/.env', 'ai/.env'])
    project = compose.get('COMPOSE_PROJECT_NAME')
    if project and not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', project):
        errors.append('COMPOSE_PROJECT_NAME must use lowercase letters, digits, hyphens or underscores')
    stale = compose.get('STALE_SECONDS', '30')
    if not stale.isdecimal() or not 10 <= int(stale) <= 3600:
        errors.append('STALE_SECONDS must be an integer from 10 to 3600')
    for key, configs in [('JWT_SECRET', [compose, api]), ('AI_INTERNAL_SECRET', [compose, api, ai])]:
        values = [config.get(key, '') for config in configs]
        if any(len(value) < 32 or not all('!' <= c <= '~' for c in value) or re.search(r'change.me|your.secret|dev.secret', value, re.I) for value in values):
            errors.append(f'{key} must contain at least 32 ASCII characters without whitespace')
        if len(set(values)) != 1:
            errors.append(f'{key} differs between service environment files')
    if compose.get('JWT_SECRET') == compose.get('AI_INTERNAL_SECRET'):
        errors.append('JWT_SECRET and AI_INTERNAL_SECRET must differ')
    ports = {}
    for key, default in [('WEB_PORT', '8080'), ('API_PORT', '8000'), ('DB_PORT', '5433')]:
        value = compose.get(key, default)
        if not value.isdecimal() or not 1 <= int(value) <= 65535:
            errors.append(f'{key} must be a port from 1 to 65535')
        else:
            ports[key] = int(value)
    if len(set(ports.values())) != len(ports):
        errors.append('Local web, API and database ports must differ')
    origin = compose.get('WEB_ORIGIN', '')
    display_origin = None
    try:
        parsed = urlsplit(origin)
        if parsed.scheme not in {'http', 'https'} or not parsed.hostname or parsed.username or parsed.password or parsed.path or parsed.query or parsed.fragment:
            raise ValueError()
        if parsed.hostname not in {'localhost', '127.0.0.1'}:
            errors.append('This check targets loopback Compose; verify an external deployment separately')
        if parsed.hostname in {'localhost', '127.0.0.1'} and (parsed.port or (443 if parsed.scheme == 'https' else 80)) != ports.get('WEB_PORT'):
            errors.append('WEB_ORIGIN does not match WEB_PORT')
        display_origin = origin
    except ValueError:
        errors.append('WEB_ORIGIN must be an exact HTTP(S) origin')
    for key, config, host, port, username, password_key in [
        ('COMPOSE_DATABASE_URL', compose, 'db', 5432, 'healthguard_app', 'APP_DB_PASSWORD'),
        ('COMPOSE_MIGRATION_DATABASE_URL', compose, 'db', 5432, 'postgres', 'POSTGRES_PASSWORD'),
        ('DATABASE_URL', api, '127.0.0.1', ports.get('DB_PORT'), 'healthguard_app', 'APP_DB_PASSWORD'),
        ('MIGRATION_DATABASE_URL', api, '127.0.0.1', ports.get('DB_PORT'), 'postgres', 'POSTGRES_PASSWORD'),
    ]:
        try:
            url = urlsplit(config.get(key, ''))
            valid_host = url.hostname == host or (host == '127.0.0.1' and url.hostname == 'localhost')
            valid = url.scheme in {'postgres', 'postgresql'} and valid_host and url.port == port and url.path == '/healthguard'
            valid = valid and unquote(url.username or '') == username and bool(compose.get(password_key))
            valid = valid and unquote(url.password or '') == compose.get(password_key)
            if not valid:
                errors.append(f'{key} does not match the local Compose database/role; review before starting')
        except ValueError:
            errors.append(f'{key} is not a valid local PostgreSQL URL')
    if not compose.get('GEMINI_API_KEY'):
        warnings.append('Gemini key absent: local AI uses explicit fallbacks')
    else:
        warnings.append('Gemini credential is present; provider authorization is a separate check')
    simulator = read_env(root / 'simulator/.env')
    if not simulator.get('DEVICE_KEY'):
        warnings.append('Simulator needs a provisioned device credential before use')
    else:
        if len(simulator['DEVICE_KEY']) < 32:
            errors.append('Simulator DEVICE_KEY is too short; provision a device credential')
        try:
            url = urlsplit(simulator.get('API_BASE_URL', ''))
            if url.scheme != 'http' or url.hostname not in {'localhost', '127.0.0.1'} or url.port != ports.get('API_PORT') or url.path.rstrip('/') != '/api/v1' or url.username or url.password or url.query or url.fragment:
                errors.append('Simulator API_BASE_URL does not match the local API')
        except ValueError:
            errors.append('Simulator API_BASE_URL is invalid')
    if services and not errors:
        for name, url in [('web', origin), ('api', f"http://127.0.0.1:{ports['API_PORT']}/health/ready")]:
            try:
                with urlopen(url, timeout=5) as response:
                    if response.status != 200:
                        raise URLError('not ready')
                    body = response.read(262144)
                    expected = json.loads(body).get('status') == 'ready' if name == 'api' else 'vyana' in body.decode('utf-8', errors='replace').lower()
                    if not expected:
                        raise URLError('unexpected service')
            except (URLError, TimeoutError, OSError, ValueError):
                errors.append(f'{name} is not reachable/ready on its configured local endpoint')
    return {'configured': not errors, 'web_origin': display_origin, 'services_checked': services,
            'errors': errors, 'notes': warnings}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--services', action='store_true', help='Also check the configured web/API endpoints')
    args = parser.parse_args()
    try:
        result = inspect(services=args.services)
    except (ValueError, UnicodeError):
        result = {'configured': False, 'errors': ['An environment file could not be parsed; review its quoting/encoding']}
    print(json.dumps(result, indent=2))
    return 0 if result['configured'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
