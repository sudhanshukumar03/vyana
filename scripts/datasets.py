"""Download and verify public recorded datasets; no connection to Vyana ingestion or SOS."""
import argparse
import hashlib
import json
import os
import re
import tempfile
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import UTC, datetime
from pathlib import Path, PurePosixPath
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'datasets/catalog.json'
RAW = ROOT / 'datasets/raw'
MAX_FILE_BYTES = 32 * 1024 * 1024


def sha256(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def destination(directory, name):
    relative = PurePosixPath(name)
    if not relative.parts or relative.is_absolute() or any(not re.fullmatch(r'[A-Za-z0-9_.-]+', part) or part in ('.', '..')
                                     for part in relative.parts):
        raise ValueError('Unsafe dataset file path')
    target = directory.joinpath(*relative.parts)
    if not target.resolve().is_relative_to(directory.resolve()):
        raise ValueError('Dataset path escapes its directory')
    return target


def checksums(text):
    result = {}
    for line in text.splitlines():
        if not line.strip():
            continue
        digest, name = line.split(maxsplit=1)
        name = name.lstrip('*')
        if not re.fullmatch(r'[0-9a-f]{64}', digest):
            raise ValueError('Invalid source checksum')
        if name in result:
            raise ValueError('Duplicate source checksum path')
        result[name] = digest
    return result


def metadata(url):
    with urlopen(Request(url, headers={'User-Agent': 'Vyana-Recorded-Dataset-Setup/1.0'}), timeout=30) as response:
        data = response.read(2 * 1024 * 1024 + 1)
    if len(data) > 2 * 1024 * 1024:
        raise ValueError('Unexpectedly large metadata response')
    return data


def save_metadata(directory, name, data):
    path = destination(directory, name)
    if path.exists() and path.read_bytes() != data:
        raise ValueError(f'{path.relative_to(ROOT)} differs from the source; preserve your copy before downloading again')
    path.parent.mkdir(parents=True, exist_ok=True)
    if not path.exists():
        path.write_bytes(data)


def fetch_file(directory, base_url, name, expected):
    target = destination(directory, name)
    if target.exists():
        if sha256(target) != expected:
            raise ValueError(f'{target.relative_to(ROOT)} failed SHA-256; existing file was preserved')
        return {'path': name, 'sha256': expected, 'bytes': target.stat().st_size}
    target.parent.mkdir(parents=True, exist_ok=True)
    for attempt in range(3):
        handle, temp_name = tempfile.mkstemp(prefix=target.name + '.', suffix='.part', dir=target.parent)
        partial = Path(temp_name)
        try:
            digest, size = hashlib.sha256(), 0
            request = Request(base_url + name, headers={'User-Agent': 'Vyana-Recorded-Dataset-Setup/1.0'})
            with os.fdopen(handle, 'wb') as output, urlopen(request, timeout=30) as response:
                for block in iter(lambda: response.read(1024 * 1024), b''):
                    size += len(block)
                    if size > MAX_FILE_BYTES:
                        raise ValueError('Unexpectedly large dataset file')
                    digest.update(block)
                    output.write(block)
            if digest.hexdigest() != expected:
                raise ValueError(f'{name} does not match the publisher SHA-256')
            os.replace(partial, target)
            return {'path': name, 'sha256': expected, 'bytes': size}
        except (OSError, ValueError):
            if attempt == 2:
                raise
            time.sleep(attempt + 1)
        finally:
            partial.unlink(missing_ok=True)


def recording_files(spec, records):
    if len(records) != spec['record_count'] or len(set(records)) != len(records):
        raise ValueError('Publisher record count differs from the pinned catalog')
    if any(not re.fullmatch(r'[A-Za-z0-9_-]+', record) for record in records):
        raise ValueError('Unsafe recording identifier')
    if spec['id'] == 'bidmc':
        if any(not re.fullmatch(r'bidmc\d{2}', record) for record in records):
            raise ValueError('Unexpected BIDMC recording identifier')
        return [f'bidmc_csv/bidmc_{record[5:]}_{suffix}' for record in records
                for suffix in ['Signals.csv', 'Numerics.csv', 'Breaths.csv', 'Fix.txt']]
    return [record + extension for record in records for extension in ['.dat', '.hea', '.atr']]


def download(spec, workers):
    directory = RAW / spec['id'] / spec['version']
    source_index = metadata(spec['files_url'] + 'SHA256SUMS.txt')
    expected = checksums(source_index.decode('utf-8'))
    record_bytes = metadata(spec['files_url'] + 'RECORDS')
    if hashlib.sha256(record_bytes).hexdigest() != expected.get('RECORDS'):
        raise ValueError('Publisher record list failed its checksum')
    records = record_bytes.decode('utf-8').split()
    names = recording_files(spec, records)
    names += [name for name in ['ANNOTATORS', 'README', 'LICENSE', 'DBS'] if name in expected]
    if any(name not in expected for name in names):
        raise ValueError('Required recording file is missing from the source checksum index')
    save_metadata(directory, 'SHA256SUMS.txt', source_index)
    save_metadata(directory, 'RECORDS', record_bytes)
    # Preserve the exact dataset attribution page and licence, including versions.
    for name, url in [('SOURCE.html', spec['source']), ('LICENSE.html', spec['license_url'])]:
        if not destination(directory, name).exists():
            save_metadata(directory, name, metadata(url))
    save_metadata(directory, 'CITATION.txt', (spec['citation'] + '\n').encode('utf-8'))
    print(f"{spec['id']}: {len(records)} recordings, {len(names)} source files", flush=True)
    files = []
    file_base_url = spec.get('mirror_url', spec['files_url'])
    with ThreadPoolExecutor(max_workers=workers) as pool:
        pending = [pool.submit(fetch_file, directory, file_base_url, name, expected[name]) for name in names]
        for future in as_completed(pending):
            files.append(future.result())
            if len(files) % 25 == 0 or len(files) == len(names):
                print(f"{spec['id']}: verified {len(files)}/{len(names)} files", flush=True)
    files.append({'path': 'RECORDS', 'sha256': expected['RECORDS'], 'bytes': len(record_bytes)})
    receipt = {'dataset': spec['id'], 'version': spec['version'], 'record_count': len(records),
               'acquired_at_utc': datetime.now(UTC).isoformat(), 'source': spec['source'],
               'download_base_url': file_base_url,
               'format': spec['format'], 'source_kind': 'RecordedDataset', 'live_sensor_data': False,
               'sos_ingestion_enabled': False, 'publisher_checksum_index_sha256': hashlib.sha256(source_index).hexdigest(),
               'license_url': spec['license_url'], 'files': sorted(files, key=lambda item: item['path'])}
    (directory / 'download.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
    return verify(spec)


def verify(spec):
    directory = RAW / spec['id'] / spec['version']
    receipt = json.loads((directory / 'download.json').read_text(encoding='utf-8'))
    if sha256(directory / 'SHA256SUMS.txt') != receipt['publisher_checksum_index_sha256']:
        raise ValueError('Saved publisher checksum index changed')
    expected = checksums((directory / 'SHA256SUMS.txt').read_text(encoding='utf-8'))
    records = (directory / 'RECORDS').read_text(encoding='utf-8').split()
    provenance = {'dataset': spec['id'], 'version': spec['version'], 'record_count': len(records),
                  'source': spec['source'], 'license_url': spec['license_url'], 'source_kind': 'RecordedDataset'}
    if any(receipt.get(key) != value for key, value in provenance.items()) or any(
            receipt.get(key) is not False for key in ['live_sensor_data', 'sos_ingestion_enabled']):
        raise ValueError('Download receipt provenance differs from the recorded dataset catalog')
    notices = [name for name in ['ANNOTATORS', 'README', 'LICENSE', 'DBS'] if name in expected]
    required = set(recording_files(spec, records) + ['RECORDS'] + notices)
    listed = {item['path'] for item in receipt['files']}
    if not required.issubset(listed) or len(listed) != len(receipt['files']):
        raise ValueError('Download receipt is missing required files or contains duplicates')
    total = 0
    for item in receipt['files']:
        path = destination(directory, item['path'])
        if item['sha256'] != expected.get(item['path']) or sha256(path) != item['sha256']:
            raise ValueError(f"{spec['id']}/{item['path']}: checksum mismatch")
        size = path.stat().st_size
        if item['bytes'] != size:
            raise ValueError(f"{spec['id']}/{item['path']}: receipt byte count mismatch")
        total += size
    for name in ['LICENSE.html', 'SOURCE.html', 'CITATION.txt']:
        if not (directory / name).is_file() or (directory / name).stat().st_size == 0:
            raise ValueError('Dataset attribution metadata is missing')
    return {'dataset': spec['id'], 'version': spec['version'], 'recordings': len(records),
            'verified_files': len(receipt['files']), 'bytes': total, 'source_kind': 'RecordedDataset',
            'live_sensor_data': False, 'sos_ingestion_enabled': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['download', 'verify'])
    parser.add_argument('--dataset', choices=['mitdb', 'bidmc', 'vfdb'], action='append')
    parser.add_argument('--workers', type=int, choices=range(1, 7), default=4)
    args = parser.parse_args()
    if not RAW.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError('Dataset storage must stay inside this workspace')
    selected = [spec for spec in json.loads(CATALOG.read_text(encoding='utf-8'))['datasets']
                if spec['selected'] and (not args.dataset or spec['id'] in args.dataset)]
    for spec in selected:
        result = download(spec, args.workers) if args.command == 'download' else verify(spec)
        print(json.dumps(result), flush=True)


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        print(f'Dataset setup failed: {error}', flush=True)
        raise SystemExit(1) from None
