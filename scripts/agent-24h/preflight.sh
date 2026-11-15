#!/usr/bin/env bash
# Diagnóstico SOMENTE LEITURA para eventual host do agente Alfred.
# Não instala, não faz login, não faz chamadas HTTP, não escreve, não inicia serviços.
set -euo pipefail

say() { printf '%s\n' "$1"; }
die() { say "[FALHA] $1" >&2; exit 1; }
[ "$#" -le 1 ] || die "Uso: bash preflight.sh [diretorio-do-Alfred-Laboratory]"
target="."
if [ "$#" -eq 1 ]; then target="$1"; fi
[ -d "$target" ] || die "Diretório não existe."
repo_dir="$(cd "$target" && pwd -P)"

for cmd in git node df awk uname; do
  command -v "$cmd" >/dev/null 2>&1 || die "Comando obrigatório ausente: $cmd"
done
node_major="$(node -p "Number(process.versions.node.split('.')[0])")"
[ "$node_major" -ge 22 ] || die "É necessário Node >= 22; encontrado $(node --version)."

inside="$(git -C "$repo_dir" rev-parse --is-inside-work-tree 2>/dev/null || true)"
[ "$inside" = "true" ] || die "Diretório não é um checkout Git."
root="$(git -C "$repo_dir" rev-parse --show-toplevel)"
[ "$root" = "$repo_dir" ] || die "Informe a raiz do checkout, não uma subpasta."

# Nunca imprimir URL: remotes podem conter token embutido.
remote_url="$(git -C "$repo_dir" remote get-url origin 2>/dev/null || true)"
case "$remote_url" in
  "https://github.com/BM000001/Alfred-Laboratory" | \
  "https://github.com/BM000001/Alfred-Laboratory.git" | \
  "git@github.com:BM000001/Alfred-Laboratory" | \
  "git@github.com:BM000001/Alfred-Laboratory.git" | \
  "ssh://git@github.com/BM000001/Alfred-Laboratory" | \
  "ssh://git@github.com/BM000001/Alfred-Laboratory.git")
    ;;
  *) die "Remote origin não é o repositório Laboratory aprovado." ;;
esac
[ -z "$(git -C "$repo_dir" status --porcelain)" ] || die "Checkout tem alterações pendentes; não preparar execução concorrente."

arch="$(uname -m)"
case "$arch" in
  aarch64 | arm64 | x86_64 | amd64) ;;
  *) die "Arquitetura não validada para preflight: $arch" ;;
esac
disk_mb="$(df -Pm "$repo_dir" | awk 'NR==2 {print $4}')"
[ "$disk_mb" -ge 2048 ] || die "Menos de 2 GB livres; host insuficiente para preparação."

say "[OK] Ferramentas básicas e Node >= 22."
say "[OK] Checkout limpo do Alfred-Laboratory."
say "[OK] Arquitetura: $arch. Espaço livre: $disk_mb MB."
say "[PENDENTE] Conta/VM Always Free, compatibilidade real do executor ARM64, permissões GitHub, modelo de IA e limites de uso."
say "[SEGURANÇA] Nenhuma instalação, login, rede, mutação ou serviço efetuado."
