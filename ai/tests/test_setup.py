import importlib.util
from pathlib import Path
from urllib.parse import unquote, urlsplit
import pytest


def setup_module_at(tmp_path):
    path = Path(__file__).resolve().parents[2] / 'scripts/setup_env.py'
    spec = importlib.util.spec_from_file_location('setup_fixture', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ROOT = tmp_path
    (tmp_path / 'apps/api').mkdir(parents=True)
    (tmp_path / 'ai').mkdir()
    return module


def doctor_module():
    directory = Path(__file__).resolve().parents[2] / 'scripts'
    with pytest.MonkeyPatch.context() as patch:
        patch.syspath_prepend(str(directory))
        spec = importlib.util.spec_from_file_location('doctor_fixture', directory / 'check_config.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    return module


def test_environment_setup_preserves_urls_keys_and_converts_utf16(tmp_path, capsys):
    path = Path(__file__).resolve().parents[2] / "scripts/setup_env.py"
    spec = importlib.util.spec_from_file_location("setup_environment", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ROOT = tmp_path
    (tmp_path / "apps/api").mkdir(parents=True)
    (tmp_path / "ai").mkdir()
    url = "postgresql://preserved:synthetic@127.0.0.1:5433/existing"
    (tmp_path / "apps/api/.env").write_text(f"DATABASE_URL={url}\n", encoding="utf-16")
    (tmp_path / "ai/.env").write_text("GEMINI_API_KEY=synthetic-preserved-provider-key\n", encoding="utf-8")
    module.main()
    root = module.read_env(tmp_path / ".env")
    api = module.read_env(tmp_path / "apps/api/.env")
    ai = module.read_env(tmp_path / "ai/.env")
    assert root["GEMINI_API_KEY"] == ai["GEMINI_API_KEY"] == "synthetic-preserved-provider-key"
    assert api["DATABASE_URL"] == url
    assert len(root["JWT_SECRET"]) >= 32
    assert root["JWT_SECRET"] != root["AI_INTERNAL_SECRET"] == api["AI_INTERNAL_SECRET"] == ai["AI_INTERNAL_SECRET"]
    assert "synthetic-preserved" not in capsys.readouterr().out
    assert b"\x00" not in (tmp_path / "apps/api/.env").read_bytes()
    module.main()
    assert module.read_env(tmp_path / ".env") == root


def test_setup_preserves_existing_passwords_and_encodes_database_urls(tmp_path):
    module = setup_module_at(tmp_path)
    passwords = {'POSTGRES_PASSWORD': 'existing #$ database', 'APP_DB_PASSWORD': "app #$'/:password"}
    module.write_env(tmp_path / '.env', passwords)
    module.main()
    root = module.read_env(tmp_path / '.env')
    api = module.read_env(tmp_path / 'apps/api/.env')
    assert all(root[key] == value for key, value in passwords.items())
    assert unquote(urlsplit(api['DATABASE_URL']).password) == passwords['APP_DB_PASSWORD']
    assert unquote(urlsplit(root['COMPOSE_MIGRATION_DATABASE_URL']).password) == passwords['POSTGRES_PASSWORD']
    assert doctor_module().inspect(tmp_path)['configured'] is True


def test_setup_adopts_existing_service_secrets_without_rotating_them(tmp_path):
    module = setup_module_at(tmp_path)
    saved = {'JWT_SECRET': 'existing-signing-secret-at-least-32-characters',
             'AI_INTERNAL_SECRET': 'existing-internal-secret-at-least-32-characters'}
    module.write_env(tmp_path / 'apps/api/.env', saved)
    module.write_env(tmp_path / 'ai/.env', {'AI_INTERNAL_SECRET': saved['AI_INTERNAL_SECRET']})
    module.main()
    root = module.read_env(tmp_path / '.env')
    assert all(root[key] == value for key, value in saved.items())


@pytest.mark.parametrize('root_values,api_values', [
    ({'JWT_SECRET': 'short-existing-value'}, {}),
    ({'JWT_SECRET': 'first-signing-secret-at-least-32-characters'},
     {'JWT_SECRET': 'another-signing-secret-at-least-32-characters'}),
    ({'JWT_SECRET': 'same-secret-for-both-at-least-32-characters',
      'AI_INTERNAL_SECRET': 'same-secret-for-both-at-least-32-characters'}, {}),
])
def test_setup_refuses_invalid_or_conflicting_secrets_before_writing(tmp_path, root_values, api_values):
    module = setup_module_at(tmp_path)
    module.write_env(tmp_path / '.env', root_values)
    module.write_env(tmp_path / 'apps/api/.env', api_values)
    before = {path: path.read_bytes() for path in tmp_path.rglob('.env')}
    with pytest.raises(ValueError):
        module.main()
    assert all(path.read_bytes() == value for path, value in before.items())
    assert not (tmp_path / 'ai/.env').exists()


def test_environment_quotes_comments_and_exports_round_trip(tmp_path):
    module = setup_module_at(tmp_path)
    path = tmp_path / '.env'
    path.write_text('export NAME = "example value" # comment\nHASH=plain # comment\n', encoding='utf-8')
    assert module.read_env(path) == {'NAME': 'example value', 'HASH': 'plain'}
    original = {'VALUE': "literal $' # \\ token"}
    module.write_env(path, original)
    assert module.read_env(path) == original


def test_configuration_service_check_rejects_another_app_on_the_web_port(tmp_path, monkeypatch):
    module = setup_module_at(tmp_path)
    module.main()
    doctor = doctor_module()

    class Response:
        status = 200

        def __init__(self, url):
            self.url = url

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self, _limit):
            return b'{"status":"ready"}' if '/health/ready' in self.url else b'<title>Another application</title>'

    monkeypatch.setattr(doctor, 'urlopen', lambda url, timeout: Response(url))
    result = doctor.inspect(tmp_path, services=True)
    assert result['configured'] is False
    assert any('web' in message for message in result['errors'])


@pytest.mark.parametrize('key,value', [
    ('JWT_SECRET', 'mismatched-signing-secret-at-least-32-characters'),
    ('DATABASE_URL', 'postgresql://wrong@localhost:5432/another_project'),
])
def test_configuration_check_rejects_service_drift(tmp_path, key, value):
    module = setup_module_at(tmp_path)
    module.main()
    path = tmp_path / 'apps/api/.env'
    api = module.read_env(path)
    api[key] = value
    module.write_env(path, api)
    result = doctor_module().inspect(tmp_path)
    assert result['configured'] is False
    assert any(key in error for error in result['errors'])
    assert value not in str(result)


def test_configuration_check_does_not_expose_origin_credentials(tmp_path):
    module = setup_module_at(tmp_path)
    module.main()
    values = module.read_env(tmp_path / '.env')
    values['WEB_ORIGIN'] = 'http://user:private-origin-password@localhost:8080'
    module.write_env(tmp_path / '.env', values)
    result = doctor_module().inspect(tmp_path)
    assert result['configured'] is False
    assert result['web_origin'] is None
    assert 'private-origin-password' not in str(result)
