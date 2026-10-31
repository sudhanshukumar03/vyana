#pragma once

// Implemented by main.cpp: enqueue without blocking acquisition. One separate
// task owns serial output so delivery logs cannot split JSON/ECG records.
void diagnosticLine(const char* line);
void diagnosticPrintf(const char* format, ...);
