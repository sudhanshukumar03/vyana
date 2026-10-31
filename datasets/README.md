# Recorded reference datasets

These are public patient recordings for offline engineering evaluation. They are not live AD8232/MAX30102 readings, generated examples, or proof that Vyana predicts a heart attack or cardiac arrest. No ML model, RAG system or automatic SOS connection is added here.

## Included datasets

| Dataset | Downloaded selection | Relevant use |
| --- | --- | --- |
| [MIT-BIH Arrhythmia, 1.0.0](https://physionet.org/content/mitdb/1.0.0/) | All 48 records: original `.dat`, `.hea` and `.atr` files | ECG waveforms with expert reference beat/rhythm annotations |
| [BIDMC PPG and Respiration, 1.0.0](https://physionet.org/content/bidmc/1.0.0/) | All 53 recording groups in original CSV format: signals, numerics, breaths and fixed metadata | Synchronized ECG/PPG/respiration and monitor HR/SpO2 numerics |
| [MIT-BIH Malignant Ventricular Ectopy, 1.0.0](https://physionet.org/content/vfdb/1.0.0/) | All 22 records: original `.dat`, `.hea` and `.atr` files | Annotated recorded rhythms, including VT and VF; annotations identify episodes, not future events |

The [catalog](catalog.json) records source URLs, pinned versions, citations, licences, sensor relevance and limitations. Original source pages and licence pages are archived beside the data. BIDMC's supplied `LICENSE` modification notice is retained as well. The data remains unmodified. MIT-BIH and VFDB recording files use PhysioNet's published public S3 mirror; BIDMC uses PhysioNet's archive. All files are checked against the checksum lists for the pinned versions on PhysioNet.

## Files and commands

Downloaded files live locally under `datasets/raw/<dataset>/<version>/`. Raw data is excluded from Git and Docker build contexts. The catalog, instructions and downloader stay in the repository, so another checkout can reproduce the selection.

```powershell
# Fetch all three selected datasets; already verified files are reused.
python scripts/datasets.py download

# Verify every selected file without network access.
python scripts/datasets.py verify

# Download or verify one database.
python scripts/datasets.py download --dataset bidmc
python scripts/datasets.py verify --dataset mitdb
```

The equivalent package commands are `pnpm datasets:download` and `pnpm datasets:verify`. Python's standard library is sufficient; no ML dependencies are installed. Each source recording and metadata file covered by the publisher's `SHA256SUMS.txt` is checked. A `download.json` receipt records the downloaded file list, hashes and byte counts. It labels the source `RecordedDataset`, with `live_sensor_data=false` and `sos_ingestion_enabled=false`. An incomplete or corrupted download fails verification. Existing files with a different checksum are preserved and reported, rather than silently overwritten.

## Where to start without ML

1. Open BIDMC's `bidmc_csv/bidmc_01_Numerics.csv` for timestamped reference values. Its `bidmc_01_Signals.csv` contains the synchronized waveforms. CSV headings specify the available channels; do not invent missing temperature, red/IR or other measurements. Preserve `NaN` entries as missing values; for example, the two breath annotators can have different numbers of annotations.
2. For ECG databases, `.dat` contains signal samples, `.hea` describes channels/scaling/sample rate, and `.atr` contains reference annotations. These are WFDB files, not image files. Use the dataset's PhysioNet waveform viewer or [WFDB tools](https://wfdb.readthedocs.io/) to inspect them.
3. A future recorded-data viewer should display **RECORDED DATASET - NOT LIVE SENSOR INPUT**, plus dataset version, record ID and original sampling rate. Display reference annotations as reference labels; they are not Vyana model predictions.
4. Keep replay separate from live device accounts, patient history and SOS ingestion. Do not change the source to an ESP32 hardware identifier or replace historical recording time with the current time to bypass freshness checks. A notification demonstration must be a separately labelled, explicitly authorized test.

## Interpretation limits

AD8232 supplies one ECG lead; clinical dataset leads, filtering, units and sample rates may differ from your board. BIDMC uses hospital monitors and is not a calibration dataset for MAX30102 red/IR hardware or its oxygen-saturation algorithm. Dataset analysis does not establish the quality of your own hardware. Fix clipping and missing live samples independently.

Local format inspection on 29 October 2026 checked all 70 MIT-BIH/VFDB headers against waveform byte lengths and parsed all 159 BIDMC CSV files. Each BIDMC signals file has 60,001 data rows, each numerics file has 481, and all 53 fixed-metadata files are nonempty. The publisher-matching BIDMC originals contain these details to handle before analysis:

- Breath annotation columns contain 121 `NaN` cells in total. Treat each annotator column independently.
- Annotator 2 has an out-of-order entry in `bidmc_09_Breaths.csv` at CSV row 122 and `bidmc_19_Breaths.csv` at row 63; row numbers include the header. Check ordering before calculating intervals. Any derived sorting should preserve the original files and annotation provenance.
- `bidmc_23_Numerics.csv` starts at -1 second. Align signals and numerics by their supplied timestamps, rather than by row index.

If ML is considered later, keep patients and overlapping windows out of opposing training/test groups. MIT-BIH records 201 and 202 come from the same subject. VFDB and the Sudden Cardiac Death Holter collection share recordings, so they cannot automatically be treated as independent training and validation databases. There are no official project-generated train/test splits or model accuracy claims in this download.

## Visited but not downloaded

- [Sudden Cardiac Death Holter, 1.0.0](https://physionet.org/content/sddb/1.0.0/): longer recordings for a later event-timing study; overlaps VFDB and has incomplete audited annotations.
- [PTB-XL, 1.0.3](https://physionet.org/content/ptb-xl/1.0.3/): approximately 3 GB of 12-lead data. Its infarction labels support retrospective ECG interpretation, not a claim of predicting a future heart attack using the current single-lead hardware.

## Attribution

Contains information from the MIT-BIH Arrhythmia Database, BIDMC PPG and Respiration Dataset, and MIT-BIH Malignant Ventricular Ectopy Database, made available under the [Open Data Commons Attribution License v1.0](https://physionet.org/content/mitdb/view-license/1.0.0/). Cite each dataset, its original publication and the [PhysioNet platform publication](https://doi.org/10.1038/s44360-026-00096-z), listed in `catalog.json`, when using recordings, plots or results. Retain the licence notices when sharing a copy. The project's software licence does not replace dataset licences.
