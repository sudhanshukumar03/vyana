import hashlib
import importlib.util
import io
import json
from pathlib import Path

import pytest


@pytest.fixture
def datasets(tmp_path):
    filename = Path(__file__).resolve().parents[2] / 'scripts/datasets.py'
    spec = importlib.util.spec_from_file_location('dataset_setup_fixture', filename)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ROOT = tmp_path
    module.RAW = tmp_path / 'datasets/raw'
    return module


@pytest.mark.parametrize('name', ['../outside.dat', '/outside.dat', 'C:/outside.dat', 'nested\\outside.dat', '', '.'])
def test_dataset_paths_cannot_escape_storage(datasets, tmp_path, name):
    with pytest.raises(ValueError):
        datasets.destination(tmp_path / 'raw', name)


def test_existing_corrupt_record_is_preserved_instead_of_overwritten(datasets, tmp_path):
    target = tmp_path / '100.dat'
    target.write_bytes(b'locally modified recording')
    with pytest.raises(ValueError, match='existing file was preserved'):
        datasets.fetch_file(tmp_path, 'https://example.test/', '100.dat', hashlib.sha256(b'original recording').hexdigest())
    assert target.read_bytes() == b'locally modified recording'


def test_bad_download_checksum_never_becomes_an_accepted_dataset_file(datasets, tmp_path, monkeypatch):
    monkeypatch.setattr(datasets, 'urlopen', lambda *_args, **_kwargs: io.BytesIO(b'tampered recording'))
    monkeypatch.setattr(datasets.time, 'sleep', lambda *_: None)
    with pytest.raises(ValueError, match='publisher SHA-256'):
        datasets.fetch_file(tmp_path, 'https://example.test/', '100.dat', hashlib.sha256(b'original recording').hexdigest())
    assert not (tmp_path / '100.dat').exists()
    assert not list(tmp_path.glob('*.part'))


def test_both_waveform_and_reference_labels_are_required(datasets):
    assert datasets.recording_files({'id': 'mitdb', 'record_count': 1}, ['100']) == ['100.dat', '100.hea', '100.atr']
    with pytest.raises(ValueError, match='record count'):
        datasets.recording_files({'id': 'mitdb', 'record_count': 2}, ['100'])


def test_bidmc_selection_keeps_paired_signals_numerics_and_annotations(datasets):
    files = datasets.recording_files({'id': 'bidmc', 'record_count': 1}, ['bidmc01'])
    assert files == ['bidmc_csv/bidmc_01_Signals.csv', 'bidmc_csv/bidmc_01_Numerics.csv',
                     'bidmc_csv/bidmc_01_Breaths.csv', 'bidmc_csv/bidmc_01_Fix.txt']


@pytest.fixture
def saved_recording(datasets):
    spec = {'id': 'mitdb', 'version': '1.0.0', 'record_count': 1,
            'source': 'https://example.test/source', 'license_url': 'https://example.test/license'}
    directory = datasets.RAW / spec['id'] / spec['version']
    directory.mkdir(parents=True)
    source_files = {'100.dat': b'test waveform bytes', '100.hea': b'test header',
                    '100.atr': b'test annotations', 'RECORDS': b'100\n', 'LICENSE': b'test license notice'}
    files, index = [], []
    for name, data in source_files.items():
        (directory / name).write_bytes(data)
        digest = hashlib.sha256(data).hexdigest()
        index.append(f'{digest} {name}\n')
        files.append({'path': name, 'sha256': digest, 'bytes': len(data)})
    index_path = directory / 'SHA256SUMS.txt'
    index_path.write_text(''.join(index), encoding='utf-8')
    for name in ['LICENSE.html', 'SOURCE.html', 'CITATION.txt']:
        (directory / name).write_text('Test attribution metadata', encoding='utf-8')
    receipt = {'dataset': spec['id'], 'version': spec['version'], 'record_count': 1,
               'source': spec['source'], 'license_url': spec['license_url'], 'source_kind': 'RecordedDataset',
               'live_sensor_data': False, 'sos_ingestion_enabled': False,
               'publisher_checksum_index_sha256': datasets.sha256(index_path), 'files': files}
    return spec, directory, receipt


def save_receipt(directory, receipt):
    (directory / 'download.json').write_text(json.dumps(receipt), encoding='utf-8')


def test_complete_recorded_dataset_verifies(datasets, saved_recording):
    spec, directory, receipt = saved_recording
    save_receipt(directory, receipt)
    result = datasets.verify(spec)
    assert result['verified_files'] == 5
    assert result['recordings'] == 1


@pytest.mark.parametrize(('key', 'value'), [
    ('dataset', 'other'), ('version', '9.0.0'), ('record_count', 2),
    ('source', 'https://example.test/other'), ('license_url', 'https://example.test/other'),
    ('source_kind', 'ESP32'), ('live_sensor_data', True), ('sos_ingestion_enabled', True),
])
def test_receipt_cannot_misrepresent_dataset_provenance(datasets, saved_recording, key, value):
    spec, directory, receipt = saved_recording
    receipt[key] = value
    save_receipt(directory, receipt)
    with pytest.raises(ValueError, match='provenance'):
        datasets.verify(spec)


def test_license_notice_cannot_be_dropped_from_receipt(datasets, saved_recording):
    spec, directory, receipt = saved_recording
    (directory / 'LICENSE').unlink()
    receipt['files'] = [item for item in receipt['files'] if item['path'] != 'LICENSE']
    save_receipt(directory, receipt)
    with pytest.raises(ValueError, match='missing required files'):
        datasets.verify(spec)


def test_incorrect_receipt_byte_count_is_rejected(datasets, saved_recording):
    spec, directory, receipt = saved_recording
    receipt['files'][0]['bytes'] += 1
    save_receipt(directory, receipt)
    with pytest.raises(ValueError, match='byte count'):
        datasets.verify(spec)
