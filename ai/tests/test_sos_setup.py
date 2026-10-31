import importlib.util
from pathlib import Path
from urllib.error import HTTPError

import pytest


@pytest.fixture
def setup(tmp_path, monkeypatch):
    directory = Path(__file__).resolve().parents[2] / 'scripts'
    monkeypatch.syspath_prepend(str(directory))
    spec = importlib.util.spec_from_file_location('sos_setup_fixture', directory / 'setup_sos.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ROOT = tmp_path
    (tmp_path / 'apps/api').mkdir(parents=True)
    return module


@pytest.mark.parametrize('dialect,relative', [('node', 'apps/api/.env'), ('compose', '.env')])
def test_private_setup_preserves_unrelated_settings_and_keeps_delivery_off(setup, tmp_path, capsys, dialect, relative):
    path = tmp_path / relative
    original = {'DATABASE_URL': 'postgresql://unchanged:synthetic@localhost/example',
                'OTHER_SECRET': 'preserve $ and # and quotes', 'SOS_DELIVERY_ENABLED': 'true'}
    path.write_text('# Keep this operator note\n' + setup.render_env(original, dialect), encoding='utf-8')
    values = iter(['synthetic-email-provider-key', 'alerts@example.test'])
    setup.configure(path, dialect, 'email', prompt=lambda _: next(values))
    saved = setup.read_env(path, dialect)
    assert saved == {**original, 'SOS_DELIVERY_ENABLED': 'false',
                     'RESEND_API_KEY': 'synthetic-email-provider-key', 'SOS_FROM_EMAIL': 'alerts@example.test'}
    assert '# Keep this operator note' in path.read_text()
    assert not list(path.parent.glob('.env.sos-*.tmp'))
    result = setup.inspect(path, dialect, 'email')
    assert result['credentials_complete'] is True
    assert result['delivery_enabled'] is False
    assert result['provider_credentials_verified'] is False
    for private in ['synthetic-email-provider-key', 'alerts@example.test', original['OTHER_SECRET']]:
        assert private not in str(result) + capsys.readouterr().out


def test_invalid_phone_setup_leaves_existing_credentials_untouched(setup, tmp_path):
    path = tmp_path / 'apps/api/.env'
    path.write_text('RESEND_API_KEY=keep-synthetic-email-key\n', encoding='utf-8')
    before = path.read_bytes()
    values = iter(['AC' + '1' * 32, 'synthetic-phone-auth-token', '911'])
    with pytest.raises(ValueError, match='TWILIO_FROM_NUMBER'):
        setup.configure(path, 'node', 'phone', prompt=lambda _: next(values))
    assert path.read_bytes() == before
    assert not list(path.parent.glob('.env.sos-*.tmp'))


def test_interactive_retry_keeps_valid_credentials_and_reprompts_only_invalid_number(setup, tmp_path, capsys):
    path = tmp_path / 'apps/api/.env'
    path.write_text('DATABASE_URL=unchanged\n', encoding='utf-8')
    answers = iter(['AC' + '1' * 32, 'synthetic-phone-auth-token', '2025550100', '\u200e+1\u00a0(202)\u2011555\u20110100'])
    prompts = []

    def prompt(label):
        prompts.append(label)
        return next(answers)

    setup.configure(path, 'node', 'phone', prompt=prompt, retry_invalid=True)
    saved = setup.read_env(path, 'node')
    assert saved['TWILIO_FROM_NUMBER'] == '+12025550100'
    assert saved['TWILIO_AUTH_TOKEN'] == 'synthetic-phone-auth-token'
    assert len(prompts) == 4 and prompts[2] == prompts[3]
    assert 'synthetic-phone-auth-token' not in capsys.readouterr().out
    assert saved['SOS_DELIVERY_ENABLED'] == 'false'


def test_cancelling_partway_through_setup_saves_nothing(setup, tmp_path):
    path = tmp_path / 'apps/api/.env'
    path.write_text('DATABASE_URL=unchanged\n', encoding='utf-8')
    before = path.read_bytes()
    calls = 0

    def prompt(_):
        nonlocal calls
        calls += 1
        if calls == 2:
            raise KeyboardInterrupt
        return 'synthetic-key-not-to-save'

    with pytest.raises(KeyboardInterrupt):
        setup.configure(path, 'node', 'email', prompt=prompt)
    assert path.read_bytes() == before


def test_failed_atomic_install_preserves_environment_and_removes_temporary_secret_file(setup, tmp_path, monkeypatch):
    path = tmp_path / 'apps/api/.env'
    path.write_text('DATABASE_URL=unchanged\n', encoding='utf-8')
    before = path.read_bytes()

    def fail_install(*_):
        raise OSError('Synthetic locked-file failure')

    monkeypatch.setattr(setup.os, 'replace', fail_install)
    values = iter(['synthetic-provider-key', 'alerts@example.test'])
    with pytest.raises(OSError):
        setup.configure(path, 'node', 'email', prompt=lambda _: next(values))
    assert path.read_bytes() == before
    assert not list(path.parent.glob('.env.sos-*.tmp'))


def test_status_lists_missing_keys_without_writing_or_showing_credentials(setup, tmp_path, capsys):
    path = tmp_path / 'apps/api/.env'
    path.write_text('TWILIO_AUTH_TOKEN=synthetic-partial-secret\n', encoding='utf-8')
    before = path.read_bytes()
    assert setup.main(['--check', '--channel', 'phone']) == 1
    output = capsys.readouterr().out
    assert 'TWILIO_ACCOUNT_SID' in output and 'TWILIO_FROM_NUMBER' in output
    assert 'synthetic-partial-secret' not in output
    assert path.read_bytes() == before


def test_setup_refuses_noninteractive_secret_entry(setup, tmp_path, monkeypatch, capsys):
    monkeypatch.setattr(setup.sys.stdin, 'isatty', lambda: False)
    assert setup.main([]) == 2
    assert 'private interactive terminal' in capsys.readouterr().out
    assert not (tmp_path / 'apps/api/.env').exists()


def test_prompt_masks_tokens_while_allowing_visible_account_and_sender_entry(setup, monkeypatch):
    visible, hidden = [], []
    monkeypatch.setattr('builtins.input', lambda label: visible.append(label) or 'visible-fixture')
    monkeypatch.setattr(setup.getpass, 'getpass', lambda label: hidden.append(label) or 'hidden-fixture')
    for key in ['TWILIO_ACCOUNT_SID', 'TWILIO_FROM_NUMBER', 'SOS_FROM_EMAIL']:
        assert setup.private_prompt(key + ': ') == 'visible-fixture'
    for key in ['TWILIO_AUTH_TOKEN', 'RESEND_API_KEY']:
        assert setup.private_prompt(key + ': ') == 'hidden-fixture'
    assert len(visible) == 3 and len(hidden) == 2
    assert all('no characters will appear' in label for label in hidden)


def test_twilio_verification_uses_only_account_and_number_reads_and_never_prints_secrets(setup):
    values = {'TWILIO_ACCOUNT_SID': 'AC' + '1' * 32, 'TWILIO_AUTH_TOKEN': 'synthetic-token',
              'TWILIO_FROM_NUMBER': '+12025550100'}
    requests = []

    def request(url, sid, token):
        requests.append(url)
        assert sid == values['TWILIO_ACCOUNT_SID'] and token == values['TWILIO_AUTH_TOKEN']
        if url.endswith('/' + sid + '.json'):
            return {'sid': sid, 'status': 'active', 'type': 'Trial', 'auth_token': token}
        return {'incoming_phone_numbers': [{'phone_number': values['TWILIO_FROM_NUMBER'],
                                           'capabilities': {'sms': False, 'voice': True}}]}

    result = setup.verify_phone(values, request)
    assert result['account_authenticated'] and result['account_active'] and result['trial_account']
    assert result['sending_number_on_account'] and result['voice_capable'] and not result['sms_capable']
    assert not result['delivery_tested']
    assert len(requests) == 2 and '/IncomingPhoneNumbers.json?' in requests[1]
    for secret in values.values():
        assert secret not in str(result)


def test_twilio_verification_reports_authentication_failure_without_response_body(setup):
    values = {'TWILIO_ACCOUNT_SID': 'AC' + '1' * 32, 'TWILIO_AUTH_TOKEN': 'synthetic-token',
              'TWILIO_FROM_NUMBER': '+12025550100'}

    def request(*_):
        raise HTTPError('https://api.twilio.com/', 401, 'private provider details', {}, None)

    result = setup.verify_phone(values, request)
    assert not result['account_authenticated']
    assert result['error'] == 'twilio_http_401'
    assert 'private provider details' not in str(result)


def test_product_trial_sender_is_not_rejected_just_because_it_is_not_an_owned_number(setup):
    values = {'TWILIO_ACCOUNT_SID': 'AC' + '1' * 32, 'TWILIO_AUTH_TOKEN': 'synthetic-token',
              'TWILIO_FROM_NUMBER': '+12025550100'}

    def request(url, sid, _token):
        if url.endswith('/' + sid + '.json'):
            return {'sid': sid, 'status': 'active', 'type': 'Trial'}
        return {'incoming_phone_numbers': []}

    result = setup.verify_phone(values, request)
    assert result['account_authenticated'] and result['account_active']
    assert result['sender_verification'] == 'check_assigned_sender_in_product_trial'
    assert result['sms_capable'] is None and result['voice_capable'] is None
    assert result['trial_sms_predefined_templates_only'] is True
    assert result['error'] is None and not result['delivery_tested']
