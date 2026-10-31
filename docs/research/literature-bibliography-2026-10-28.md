# Vyana research bibliography

Search date: 28 October 2026.

Scope inferred from README.md, docs/FEATURES.md and hardware/README.md: an educational ESP32 wellness-monitoring platform with MAX30102 optical sensing, DS18B20 contact temperature, AD8232 ECG acquisition, simulated activity, live dashboards, alerts and an optional AI assistant.

Thirty relevant publications were selected using the MCP web-search connector, publisher records, PubMed/PMC, and author/institutional sources. The connected Brave browser was used to inspect the closely related ESP32-S3 paper. This is a targeted bibliography, not an exhaustive systematic review or a full critical appraisal of every paper. Some publisher full-text requests were restricted; indexed publication/abstract records and repository copies were used where available. Links may provide full text or abstracts depending on access.

The first paper's title is abbreviated with an ellipsis. The year refers to the journal/proceedings publication, rather than an earlier preprint where applicable. 'Use for Vyana' is my relevance assessment, not a claim that the paper validates this project.

## Suggested starting points

Read 1–3 for comparable implementations; 13–17 for optical signal processing and validation; 20–23 for ECG benchmarks and alerts; 28–30 for AI evaluation.

## Publications

| # | Year | Publication | Venue | Use for Vyana |
|---|---|---|---|---|
| 1 | 2026 | [ESP32-S3-Based Multimodal Wearable for Remote Vital-Sign Acquisition…](https://pmc.ncbi.nlm.nih.gov/articles/PMC13667402/) | Sensors | ESP32-S3, AD8232, MAX30102, contact temperature, web dashboards and triage; engineering proof of concept without human-participant results. |
| 2 | 2022 | [Internet of Things-Based ECG and Vitals Healthcare Monitoring System](https://pmc.ncbi.nlm.nih.gov/articles/PMC9780965/) | Micromachines | End-to-end ECG, heart-rate, SpO2 and temperature monitoring; useful architecture and reference-device comparison. |
| 3 | 2022 | [MAX30102 Photometric Biosensor Coupled to ESP32-Webserver Capabilities for Continuous Point of Care Oxygen Saturation and Heartrate Monitoring](https://www.mdpi.com/2673-4591/16/1/9) | Engineering Proceedings | Direct ESP32/MAX30102 implementation; a conference proceedings paper. |
| 4 | 2024 | [Development of Health Monitoring Wearable Device using ESP32](https://ieeexplore.ieee.org/document/10544910/) | IEEE ICICT | Comparable wearable sensing and cloud-monitoring implementation. |
| 5 | 2022 | [Development of Blood Oxygen Level, Heart Rate And Temperature Monitoring System by Using ESP32](https://ieeexplore.ieee.org/abstract/document/9870943) | IEEE conference paper | MAX30102-based vital monitoring with comparison to a hospital patient monitor. |
| 6 | 2025 | [HL7 FHIR-Based Open-Source Framework for Real-Time Biomedical Signal Acquisition and IoMT Interoperability](https://www.mdpi.com/2076-3417/15/23/12803) | Applied Sciences | Biomedical telemetry acquisition and standardized exchange; useful for a future interoperability extension. |
| 7 | 2025 | [Healthcare Monitoring Using an Internet of Things-Based Cardio System](https://doi.org/10.3390/iot6010010) | IoT | ECG, PPG, temperature and inertial sensing in an integrated cardiac-monitoring platform. |
| 8 | 2026 | [IoT-Based Isolation Ward Monitoring System Prototype](https://pmc.ncbi.nlm.nih.gov/articles/PMC13364453/) | Sensors | Sensor-to-cloud integration, edge ECG classification and mobile/desktop monitoring. |
| 9 | 2015 | [The Internet of Things for Health Care: A Comprehensive Survey](https://doi.org/10.1109/ACCESS.2015.2437951) | IEEE Access | Foundational healthcare IoT architectures, applications and security challenges. |
| 10 | 2019 | [A Survey on Internet of Things and Cloud Computing for Healthcare](https://www.mdpi.com/2079-9292/8/7/768) | Electronics | IoT, cloud and fog architecture background for the literature review. |
| 11 | 2026 | [Wearable Devices for Remote Monitoring of Chronic Diseases: Systematic Review](https://mhealth.jmir.org/2026/1/e74071/) | JMIR mHealth and uHealth | Recent overview of devices, sensors, measured parameters and applications. |
| 12 | 2026 | [A systematic review on wearable-enabled remote health monitoring](https://pmc.ncbi.nlm.nih.gov/articles/PMC12954012/) | Digital Health | Recent synthesis covering wearable monitoring, feedback and AI integration. |
| 13 | 2007 | [Photoplethysmography and its application in clinical physiological measurement](https://doi.org/10.1088/0967-3334/28/3/R01) | Physiological Measurement | PPG measurement principles underlying MAX30102 heart-rate and SpO2 processing. |
| 14 | 2023 | [The 2023 wearable photoplethysmography roadmap](https://pmc.ncbi.nlm.nih.gov/articles/PMC10686289/) | Physiological Measurement | Wearable PPG research directions, signal quality and validation challenges. |
| 15 | 2019 | [Motion Artifact Reduction for Wrist-Worn Photoplethysmograph Sensors Based on Different Wavelengths](https://pmc.ncbi.nlm.nih.gov/articles/PMC6387309/) | Sensors | Multi-wavelength processing to reduce motion interference. |
| 16 | 2019 | [Deep PPG: Large-Scale Heart Rate Estimation with Convolutional Neural Networks](https://pmc.ncbi.nlm.nih.gov/articles/PMC6679242/) | Sensors | Heart-rate estimation under movement and the PPG-DaLiA dataset; a possible future algorithm benchmark. |
| 17 | 2022 | [The Use of Wearable Pulse Oximeters in the Prompt Detection of Hypoxemia and During Movement: Diagnostic Accuracy Study](https://www.jmir.org/2022/2/e28890/) | Journal of Medical Internet Research | Validation under movement and reduced oxygen saturation; useful for designing an accuracy study. |
| 18 | 2020 | [Racial Bias in Pulse Oximetry Measurement](https://pmc.ncbi.nlm.nih.gov/articles/PMC7808260/) | New England Journal of Medicine | Original research letter relevant to subgroup performance and limitations of pulse oximetry. |
| 19 | 2016 | [Improving Pulse Rate Measurements during Random Motion Using a Wearable Multichannel Reflectance Photoplethysmograph](https://pmc.ncbi.nlm.nih.gov/articles/PMC4813917/) | Sensors | Experimental multichannel PPG work on movement-corrupted pulse measurements. |
| 20 | 1985 | [A Real-Time QRS Detection Algorithm](https://pubmed.ncbi.nlm.nih.gov/3997178/) | IEEE Transactions on Biomedical Engineering | Pan–Tompkins QRS detection; a foundation for a future real ECG-processing pipeline. |
| 21 | 2001 | [The impact of the MIT-BIH arrhythmia database](https://pubmed.ncbi.nlm.nih.gov/11446209/) | IEEE Engineering in Medicine and Biology Magazine | Annotated ECG benchmark and reproducible arrhythmia-algorithm evaluation. |
| 22 | 2020 | [PTB-XL, a large publicly available electrocardiography dataset](https://www.nature.com/articles/s41597-020-0495-6) | Scientific Data | Large annotated 12-lead ECG dataset; its acquisition setup differs from Vyana's single-lead AD8232. |
| 23 | 2015 | [The PhysioNet/Computing in Cardiology Challenge 2015: Reducing False Arrhythmia Alarms in the ICU](https://pmc.ncbi.nlm.nih.gov/articles/PMC4910643/) | Computing in Cardiology | Multisignal false-alarm benchmark relevant to future alert-evaluation work. |
| 24 | 2016 | [Reducing false arrhythmia alarms in the ICU using multimodal signals and robust QRS detection](https://pubmed.ncbi.nlm.nih.gov/27455121/) | Physiological Measurement | Combines ECG, PPG and arterial-pressure information to improve alarm decisions. |
| 25 | 2020 | [Reliability and Validity of Commercially Available Wearable Devices for Measuring Steps, Energy Expenditure, and Heart Rate: Systematic Review](https://mhealth.jmir.org/2020/9/e18694/) | JMIR mHealth and uHealth | Evidence on steps, heart rate and calorie estimates; useful context for replacing simulated activity. |
| 26 | 2021 | [Recommendations for determining the validity of consumer wearable and smartphone step count: expert statement and checklist of the INTERLIVE network](https://pmc.ncbi.nlm.nih.gov/articles/PMC8273687/) | British Journal of Sports Medicine | Step-count validation protocol for a future physical activity sensor. |
| 27 | 2021 | [Reliability and Validity of the CORE Sensor to Assess Core Body Temperature during Cycling Exercise](https://pmc.ncbi.nlm.nih.gov/articles/PMC8434645/) | Sensors | A validation example for wearable temperature estimation; evaluates CORE, not DS18B20. |
| 28 | 2023 | [Large language models encode clinical knowledge](https://www.nature.com/articles/s41586-023-06291-2) | Nature | Med-PaLM/MultiMedQA and human evaluation for factuality, harm and bias. |
| 29 | 2025 | [Toward expert-level medical question answering with large language models](https://www.nature.com/articles/s41591-024-03423-7) | Nature Medicine | Med-PaLM 2 evaluation; background for assessing medical question answering. |
| 30 | 2025 | [Towards conversational diagnostic artificial intelligence](https://www.nature.com/articles/s41586-025-08866-7) | Nature | AMIE dialogue evaluation; a methodological reference for conversational assessment. |

## Search method and limits

Search families covered ESP32/MAX30102/DS18B20/AD8232 implementations; wearable remote-monitoring reviews; PPG motion artifacts and oximetry validation; ECG/QRS detection and public datasets; multimodal alarm reduction; activity and temperature validation; and medical LLM question answering/dialogue evaluation.

Duplicates across publisher, PubMed, PMC and search indexes were consolidated. Manufacturer datasheets, blogs, patents and secondary summaries are not counted as research papers in this list. Review articles, proceedings papers, dataset descriptions and an original research letter are included and identified by their titles or notes.

No claim is made that a sensor specification, a comparator paper's accuracy, or performance on a public dataset transfers to Vyana. In particular, PTB-XL is a 12-lead dataset, the CORE study does not validate DS18B20 temperature, and Med-PaLM/AMIE results do not establish the performance of Vyana's Gemini-based assistant.

