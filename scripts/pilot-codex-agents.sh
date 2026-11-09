#!/usr/bin/env bash
# First native Codex subagent pilot for Alfred-Laboratory.
# Usage: bash scripts/pilot-codex-agents.sh --check|--run
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:---check}"
if [[ "$MODE" != "--check" && "$MODE" != "--run" || "$#" -gt 1 ]]; then
  echo "Usage: bash scripts/pilot-codex-agents.sh --check|--run" >&2
  exit 2
fi

cd "$ROOT"
python3 scripts/check-agent-profiles.py
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "ERROR: pilot requires a Git checkout of Alfred-Laboratory." >&2
  exit 1
fi
if [[ "$MODE" == "--check" ]]; then
  if command -v codex >/dev/null 2>&1; then
    codex --version
    echo "Codex CLI present. This check did NOT start an agent."
  else
    echo "Codex CLI absent. Profiles and preflight were checked; native execution NOT proven."
  fi
  exit 0
fi

# No auto-installation, credential creation, write access, merge or deployment.
if ! command -v codex >/dev/null 2>&1; then
  echo "ERROR: codex CLI not installed; no agents started." >&2
  exit 1
fi
if ! command -v timeout >/dev/null 2>&1; then
  echo "ERROR: GNU timeout is required to enforce the pilot's 10-minute safety limit." >&2
  exit 1
fi
if ! codex login status >/dev/null 2>&1; then
  echo "ERROR: Codex not authenticated; log in interactively before running the pilot." >&2
  exit 1
fi
if [[ -n "$(git status --porcelain)" ]]; then
  echo "ERROR: checkout has changes/untracked files; preserve them and use a clean worktree." >&2
  exit 1
fi

umask 077
EVIDENCE="$(mktemp -d "${TMPDIR:-/tmp}/alfred-codex-pilot.XXXXXXXX")"
echo "Pilot evidence (local, private): $EVIDENCE"
PROMPT="$(cat <<'PILOT'
Faça um piloto REAL de subagentes personalizados do Alfred, apenas leitura.
Leia AGENTS.md e docs/EQUIPE-AGENTES.md. Inicie explicitamente dois
subagentes personalizados em paralelo: explorer e reviewer.
- explorer: localize e descreva o caminho da marca em src/app/App.tsx e
  como vite.config.ts define a base URL, citando arquivos e linhas.
- reviewer: examine o mesmo comportamento para regressões de navegação,
  especialmente a diferença entre click normal e abrir em nova aba,
  citando arquivos e linhas. Não adivinhe testes em Safari.
Espere ambos terminarem e entregue dois resultados separados com o papel,
evidências, incertezas, e se houve criação real de cada subagente.
Não edite arquivos, não crie branches, commits, PRs, deploys ou conexões
externas; não execute ações de escrita no Alfred original nem no laboratório.
Se a delegação de subagentes não estiver disponível, diga que não executou
o piloto. Não simule especialistas lendo os perfis manualmente.
PILOT
)"

set +e
printf '%s\n' "$PROMPT" | timeout --signal=TERM --kill-after=10s 600s codex exec \
  --cd "$ROOT" \
  --sandbox read-only \
  --ask-for-approval never \
  -c agents.enabled=true \
  -c agents.max_concurrent_threads_per_session=2 \
  --json \
  --output-last-message "$EVIDENCE/final.txt" \
  - >"$EVIDENCE/events.jsonl" 2>"$EVIDENCE/stderr.log"
STATUS=$?
set -e

if [[ "$STATUS" -ne 0 ]]; then
  echo "ERROR: Codex exited with status $STATUS; check local evidence. Native agents NOT proven." >&2
  exit "$STATUS"
fi

python3 - "$EVIDENCE/events.jsonl" <<'PY'
import json
import sys
from pathlib import Path

events = []
invalid = 0
for line in Path(sys.argv[1]).read_text(encoding="utf-8").splitlines():
    try:
        events.append(json.loads(line))
    except json.JSONDecodeError:
        invalid += 1

completed = sum(event.get("type") == "turn.completed" for event in events if isinstance(event, dict))
failures = sum(event.get("type") in ("turn.failed", "error") for event in events if isinstance(event, dict))
# The CLI's JSONL subagent event format may evolve; a final model claim
# without machine-observable evidence never counts as native execution proof.
spawn_types = {"subagent.created", "agent.spawned", "agent.session.subagent.created"}
observed = [event for event in events if isinstance(event, dict) and event.get("type") in spawn_types]
print(f"Codex turn.completed={completed}; failures={failures}; invalid_jsonl={invalid}")
if observed:
    print(f"Machine-observed subagent creation events: {len(observed)}; inspect IDs in events.jsonl.")
else:
    print("Subagent creation NOT independently proven by recognized JSONL events.")
    print("Inspect native Codex subagent threads and events before claiming the pilot succeeded.")
PY

echo "Final response: $EVIDENCE/final.txt"
echo "Full local audit: $EVIDENCE/events.jsonl"
echo "No commit, merge or deployment was made by this script."
