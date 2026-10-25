#!/usr/bin/env bash
# Exit successfully when a nonempty PDF is at least as new as every build input.
set -euo pipefail
if [ "$#" -lt 2 ]; then exit 1; fi
output=$1
shift
[ -f "$output" ] && [ -s "$output" ] || exit 1
for input in "$@"; do
    [ -f "$input" ] && [ ! "$input" -nt "$output" ] || exit 1
done
