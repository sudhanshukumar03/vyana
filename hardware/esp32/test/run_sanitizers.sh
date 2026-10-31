#!/bin/sh
# Run from hardware/esp32 after `pio test -e native` installs pinned test libs.
# Requires GCC/Clang with AddressSanitizer and UndefinedBehaviorSanitizer.
set -eu
compiler=${CXX:-g++}
test_output=$(mktemp -d)
trap 'rm -rf "$test_output"' EXIT HUP INT TERM
for suite in test_delivery test_measurements test_sensors test_firmware; do
  "$compiler" -std=c++17 -O1 -g -fno-omit-frame-pointer \
    -fsanitize=address,undefined -fno-sanitize-recover=all \
    -DECG_STREAM_SERIAL=1 -Itest/test_sensors/mocks \
    -I.pio/libdeps/native/ArduinoJson/src -I.pio/libdeps/native/Unity/src \
    "test/$suite/test_main.cpp" .pio/libdeps/native/Unity/src/unity.c \
    -o "$test_output/$suite"
  "$test_output/$suite"
done
