#!/usr/bin/env bash
set -euo pipefail
export TZ=UTC
name=$1
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
dest="$PWD/$name.zip"
rm -f "$dest"
cp game/{index.html,style.css,app.mjs,model.mjs} "$tmp/"
cd "$tmp"
touch -t 202611270000 ./*
zip -q -X "$dest" index.html style.css app.mjs model.mjs
