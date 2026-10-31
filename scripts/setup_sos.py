"""Inspect SOS setup or privately save provider credentials, without sending notifications."""
import argparse
import base64
import getpass
import json
import os
import re
import sys
import tempfile
import unicodedata
import warnings
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, Request, build_opener

from setup_env import ROOT, read_env, render_env

CHANNEL_KEYS = {
    'email': ('RESEND_API_KEY', 'SOS_FROM_EMAIL'),
    'phone': ('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER'),
}


class SetupInputError(ValueError):
    pass


def private_prompt(label):
    if label.startswith(('RESEND_API_KEY', 'TWILIO_AUTH_TOKEN')):
        return getpass.getpass(label + '(hidden input; no characters will appear) ')
    return input(label)


class NoCredentialRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def twilio_json(url, sid, token):
    authorization = base64.b64encode(f'{sid}:{token}'.encode()).decode()
    request = Request(url, headers={'Authorization': 'Basic ' + authorization, 'Accept': 'application/json'})
    with build_opener(NoCredentialRedirect()).open(request, timeout=10) as response:
        return json.loads(response.read(262144))


def verify_phone(values, request=twilio_json):
    result = {'account_authenticated': False, 'account_active': False, 'trial_account': None,
              'sending_number_on_account': False, 'sms_capable': False, 'voice_capable': False,
              'sender_verification': 'not_checked', 'trial_sms_predefined_templates_only': None,
              'delivery_tested': False, 'error': None}
    if invalid_keys(values, 'phone'):
        return {**result, 'error': 'missing_or_invalid_phone_settings'}
    sid, token = values['TWILIO_ACCOUNT_SID'], values['TWILIO_AUTH_TOKEN']
    base = f'https://api.twilio.com/2010-04-01/Accounts/{sid}'
    try:
        account = request(base + '.json', sid, token)
        if not isinstance(account, dict) or account.get('sid') != sid:
            return {**result, 'error': 'unexpected_account_response'}
        result.update(account_authenticated=True, account_active=account.get('status') == 'active',
                      trial_account=account.get('type') == 'Trial')
        query = urlencode({'PhoneNumber': values['TWILIO_FROM_NUMBER'], 'PageSize': 1})
        numbers = request(base + '/IncomingPhoneNumbers.json?' + query, sid, token)
        if not isinstance(numbers, dict) or not isinstance(numbers.get('incoming_phone_numbers'), list):
            return {**result, 'error': 'unexpected_number_response'}
        number = next((item for item in numbers['incoming_phone_numbers']
                       if item.get('phone_number') == values['TWILIO_FROM_NUMBER']), None)
        if number:
            capabilities = number.get('capabilities') or {}
            result.update(sending_number_on_account=True, sms_capable=capabilities.get('sms') is True,
                          voice_capable=capabilities.get('voice') is True, sender_verification='owned_number_found')
        elif result['trial_account']:
            # Modern product trials assign senders per product/recipient. Their
            # absence from the owned-number list does not establish invalidity.
            result.update(sms_capable=None, voice_capable=None,
                          sender_verification='check_assigned_sender_in_product_trial',
                          trial_sms_predefined_templates_only=True)
        else:
            result['sender_verification'] = 'not_found_in_owned_numbers'
        return result
    except HTTPError as error:
        return {**result, 'error': f'twilio_http_{error.code}'}
    except (URLError, OSError):
        return {**result, 'error': 'twilio_unreachable'}
    except (ValueError, TypeError, AttributeError):
        return {**result, 'error': 'invalid_twilio_response'}


def selected_keys(channel):
    channels = CHANNEL_KEYS if channel == 'both' else (channel,)
    return [key for item in channels for key in CHANNEL_KEYS[item]]


def invalid_keys(values, channel):
    invalid = []
    for key in selected_keys(channel):
        value = values.get(key, '')
        valid = bool(value) and len(value) <= 4096 and not re.search(r'[\r\n\x00]', value)
        valid = valid and not re.search(r'YOUR_|CONFIGURE_|CHANGE_ME', value, re.I)
        if key in ('RESEND_API_KEY', 'TWILIO_AUTH_TOKEN'):
            valid = valid and not re.search(r'\s', value)
        elif key == 'SOS_FROM_EMAIL':
            valid = valid and re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+", value)
        elif key == 'TWILIO_ACCOUNT_SID':
            valid = valid and re.fullmatch(r'AC[0-9a-fA-F]{32}', value)
        elif key == 'TWILIO_FROM_NUMBER':
            valid = valid and re.fullmatch(r'\+[1-9]\d{7,14}', value)
        if not valid:
            invalid.append(key)
    return invalid


def inspect(path, dialect, channel):
    values = read_env(path, dialect)
    return {
        'environment_file_exists': path.exists(),
        'delivery_enabled': values.get('SOS_DELIVERY_ENABLED') == 'true',
        'channel': channel,
        'credentials_complete': path.exists() and not invalid_keys(values, channel),
        'missing_or_invalid': invalid_keys(values, channel),
        'provider_credentials_verified': False,
        'note': 'Local format check only; sender verification, recipients and real delivery are separate checks.',
    }


def save_values(path, dialect, updates):
    """Replace only selected keys, preserve other settings, then atomically install."""
    before = read_env(path, dialect)
    raw = path.read_bytes()
    encoding = 'utf-16' if raw.startswith((b'\xff\xfe', b'\xfe\xff')) else ('utf-16-le' if b'\x00' in raw else 'utf-8-sig')
    lines, seen = [], set()
    for line in raw.decode(encoding).splitlines():
        match = re.match(r'^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=', line)
        key = match[1] if match else None
        if key in updates:
            if key not in seen:
                lines.append(render_env({key: updates[key]}, dialect).rstrip('\n'))
                seen.add(key)
        else:
            lines.append(line)
    lines.extend(render_env({key: value}, dialect).rstrip('\n') for key, value in updates.items() if key not in seen)
    # The temporary file is covered by the existing .env.* ignore rule.
    handle, name = tempfile.mkstemp(prefix='.env.sos-', suffix='.tmp', dir=path.parent)
    temporary = Path(name)
    try:
        with os.fdopen(handle, 'w', encoding='utf-8', newline='\n') as stream:
            stream.write('\n'.join(lines) + '\n')
        if read_env(temporary, dialect) != {**before, **updates}:
            raise ValueError('Environment quoting could not be preserved; no settings changed.')
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def normalize_phone(value):
    value = unicodedata.normalize('NFKC', value)
    return re.sub(r'[^\S\r\n]|[().\-\u2010-\u2015\u200e\u200f\u200b\ufeff]', '', value)


def configure(path, dialect, channel, prompt=private_prompt, retry_invalid=False):
    if not path.exists():
        raise SetupInputError('The target environment file is missing; run project environment setup first.')
    values = read_env(path, dialect)
    updates = {}
    for key in selected_keys(channel):
        suffix = ' (Enter keeps the saved value)' if values.get(key) else ''
        while True:
            with warnings.catch_warnings():
                warnings.simplefilter('error', getpass.GetPassWarning)
                value = prompt(f'{key}{suffix}: ').strip()
            candidate = value or values.get(key, '')
            if key == 'TWILIO_FROM_NUMBER':
                candidate = normalize_phone(candidate)
            group = 'phone' if key.startswith('TWILIO_') else 'email'
            if retry_invalid and key in invalid_keys({key: candidate}, group):
                if key == 'TWILIO_FROM_NUMBER':
                    print('Enter the actual Twilio phone number starting with + and its country code.')
                    print('Copy it from Twilio Console > Phone Numbers > Manage > Active numbers.')
                    print('Do not enter the Account SID, a number label, or an emergency-service number.')
                else:
                    print(f'{key} is missing or has an invalid format. Please enter this field again.')
                print('Previous valid fields are kept privately in memory; nothing has been saved yet.')
                continue
            updates[key] = candidate
            break
    invalid = invalid_keys(updates, channel)
    if invalid:
        raise SetupInputError('Missing or invalid settings: ' + ', '.join(invalid))
    # Saving credentials must not drain existing notification jobs.
    updates['SOS_DELIVERY_ENABLED'] = 'false'
    save_values(path, dialect, updates)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true', help='Read-only status; never prints credential values')
    parser.add_argument('--verify-phone', action='store_true', help='Read-only Twilio account/number verification; never sends a message or call')
    parser.add_argument('--target', choices=['host', 'compose'], default='host')
    parser.add_argument('--channel', choices=['email', 'phone', 'both'], default='both')
    args = parser.parse_args(argv)
    path, dialect = (ROOT / 'apps/api/.env', 'node') if args.target == 'host' else (ROOT / '.env', 'compose')
    if args.check or args.verify_phone:
        result = inspect(path, dialect, args.channel)
        if args.verify_phone:
            result['twilio'] = verify_phone(read_env(path, dialect))
            result['provider_credentials_verified'] = result['twilio']['account_authenticated']
            result['note'] = 'Read-only provider check; destination permissions and real notification receipt remain untested.'
        print(json.dumps(result, indent=2))
        if args.verify_phone:
            verified = result['twilio']
            return 0 if (verified['account_authenticated'] and verified['account_active'] and
                         verified['sending_number_on_account'] and (verified['sms_capable'] or verified['voice_capable']) and
                         not verified['error']) else 1
        return 0 if result['credentials_complete'] else 1
    if not sys.stdin.isatty():
        print('Run setup in your private interactive terminal; hidden credential input is required.')
        return 2
    print('Account SID and sending number will be visible as you type.')
    print('API keys and Auth Tokens are hidden: type or paste, then press Enter even though nothing appears.')
    print('Press Ctrl+C to cancel without saving.\n')
    configure(path, dialect, args.channel, retry_invalid=True)
    print('Provider settings saved privately. Outbound delivery remains disabled.')
    print('Next: select recipients and consent in SOS settings, then arrange an explicitly authorized delivery test.')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except (KeyboardInterrupt, EOFError):
        print('\nSetup cancelled; no settings changed.')
        raise SystemExit(2) from None
    except getpass.GetPassWarning:
        print('Cannot hide credential input. Use a private interactive terminal; no settings changed.')
        raise SystemExit(2) from None
    except SetupInputError as error:
        print(str(error) + '. No settings changed.')
        raise SystemExit(2) from None
    except (OSError, ValueError, UnicodeError):
        print('SOS setup could not be completed. Check input formats and environment-file access; no credentials were printed.')
        raise SystemExit(2) from None
