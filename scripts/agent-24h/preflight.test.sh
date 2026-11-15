#!/usr/bin/env bash
# Testes de contrato do preflight: arquivos temporários e sem rede.
set -euo pipefail
script="$(cd "$(dirname "$0")" && pwd -P)/preflight.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
git -c init.defaultBranch=main init -q "$tmp/allowed"
git -C "$tmp/allowed" remote add origin https://github.com/BM000001/Alfred-Laboratory.git

bash "$script" "$tmp/allowed" >"$tmp/ok.out"
grep -q "Nenhuma instalação" "$tmp/ok.out"

git -C "$tmp/allowed" remote set-url origin https://github.com/outro/repo.git
if bash "$script" "$tmp/allowed" >"$tmp/bad.out" 2>&1; then
  echo "FALHA: remote incorreto foi aceito" >&2; exit 1
fi

git -C "$tmp/allowed" remote set-url origin git@github.com:BM000001/Alfred-Laboratory.git
touch "$tmp/allowed/alteracao.txt"
if bash "$script" "$tmp/allowed" >"$tmp/dirty.out" 2>&1; then
  echo "FALHA: checkout sujo foi aceito" >&2; exit 1
fi
if bash "$script" "$tmp" >"$tmp/notgit.out" 2>&1; then
  echo "FALHA: não-repositório foi aceito" >&2; exit 1
fi
echo "PASS: 4 cenários (válido, remoto incorreto, checkout sujo, sem git)."
