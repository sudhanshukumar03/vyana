"""Expose Arduino ESP32's SDK response-file paths to editor tooling.

The firmware compiler already reads these paths. PlatformIO's IDE metadata
and C/C++ IntelliSense also need explicit include directories.
"""

import json
import os
from pathlib import Path
import shlex
import subprocess

from SCons.Script import COMMAND_LINE_TARGETS, Import

Import("env")


def sdk_paths(build_env):
    sdk = Path(build_env.PioPlatform().get_package_dir(
        "framework-arduinoespressif32-esp32-libs"
    ))
    response = sdk / "flags" / "includes"
    flags = shlex.split(response.read_text(encoding="utf-8"))
    includes = []
    for index in range(0, len(flags), 2):
        if flags[index] != "-iwithprefixbefore":
            raise ValueError("Unexpected ESP32 SDK include flag: " + flags[index])
        directory = sdk / "include" / flags[index + 1]
        # The SDK response file also lists optional component directories that
        # are absent in this package. GCC ignores these; IntelliSense warns.
        # Export only installed directories, without changing compiler flags.
        if directory.is_dir():
            includes.append(directory.as_posix())
    return response, includes


if env.IsIntegrationDump():
    # PlatformIO uses the project environment when writing c_cpp_properties.json.
    Import("projenv")
    _, includes = sdk_paths(env)
    projenv.AppendUnique(CPPPATH=includes)


def expand_database(source, target, env):
    response, includes = sdk_paths(env)
    args = ["-I" + directory for directory in includes]
    expanded = subprocess.list2cmdline(args) if os.name == "nt" else shlex.join(args)
    database = Path(env.subst("$COMPILATIONDB_PATH"))
    entries = json.loads(database.read_text(encoding="utf-8"))
    # Replace only this known response file; preserve all other compiler flags
    # and their platform-specific quoting, including defines with string values.
    spellings = {str(response), response.as_posix()}
    for entry in entries:
        command = entry["command"]
        for spelling in spellings:
            for marker in ('"@' + spelling + '"', '@"' + spelling + '"', "@" + spelling):
                command = command.replace(marker, expanded)
        entry["command"] = command
    database.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")


if "compiledb" in COMMAND_LINE_TARGETS:
    env.AddPostAction("compiledb", expand_database)
