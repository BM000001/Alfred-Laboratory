#!/usr/bin/env bash
# Contract test: simulates Codex CLI to validate pilot flags without model use.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/bin"

cat > "$TMP/bin/codex" <<'FAKE_CODEX'
#!/usr/bin/env bash
set -euo pipefail
if [[ "${1:-}" == "--version" ]]; then
  echo "codex-cli fake-contract-test"
  exit 0
fi
if [[ "${1:-}" == "login" && "${2:-}" == "status" ]]; then
  exit 0
fi
if [[ "${1:-}" != "exec" ]]; then
  echo "Unexpected Codex command: $*" >&2
  exit 2
fi
shift

read_only=false
approval=false
max_two=false
enabled=false
json=false
prompt_stdin=false
output=""
while (( $# )); do
  case "$1" in
    --cd)
      [[ "$#" -ge 2 && -d "$2" ]] || exit 3
      shift 2 ;;
    --sandbox)
      [[ "$#" -ge 2 && "$2" == "read-only" ]] || exit 4
      read_only=true
      shift 2 ;;
    -c)
      [[ "$#" -ge 2 ]] || exit 5
      case "$2" in
        approval_policy=never) approval=true ;;
        agents.max_concurrent_threads_per_session=2) max_two=true ;;
        agents.enabled=true) enabled=true ;;
        *) echo "Unexpected override: $2" >&2; exit 6 ;;
      esac
      shift 2 ;;
    --json)
      json=true
      shift ;;
    --output-last-message)
      [[ "$#" -ge 2 ]] || exit 7
      output="$2"
      shift 2 ;;
    -)
      prompt_stdin=true
      shift ;;
    *)
      echo "Unexpected Codex exec flag: $1" >&2
      exit 8 ;;
  esac
done
[[ "$read_only" == true && "$approval" == true && "$max_two" == true && "$enabled" == true && "$json" == true && "$prompt_stdin" == true && -n "$output" ]] || {
  echo "Missing required safe Codex arguments" >&2
  exit 9
}
prompt="$(cat)"
[[ "$prompt" == *"explorer"* && "$prompt" == *"reviewer"* ]] || {
  echo "Prompt did not request both specialist roles" >&2
  exit 10
}
printf '{"type":"turn.completed"}\n'
printf 'FAKE_CLI_ONLY: native delegation not tested\n' > "$output"
FAKE_CODEX

chmod +x "$TMP/bin/codex"

# The real PR checkout is detached in Actions. Build a clean local fixture
# with the approved remote and branch without modifying the original checkout.
FIXTURE="$TMP/alfred-checkout"
mkdir -p "$FIXTURE/scripts"
cp scripts/pilot-codex-agents.sh scripts/check-agent-profiles.py "$FIXTURE/scripts/"
cp -R .codex "$FIXTURE/.codex"
(
  cd "$FIXTURE"
  git init -q
  git config user.email 'codex-test@example.invalid'
  git config user.name 'Codex Fixture'
  git checkout -q -b feat/ecc-codex-multiagent-20261109
  git remote add origin https://github.com/BM000001/Alfred-Laboratory.git
  git add .codex scripts
  git commit -qm 'ci: mock Codex pilot checkout'
)

(cd "$FIXTURE" && PATH="$TMP/bin:$PATH" bash scripts/pilot-codex-agents.sh --run) > "$TMP/result.txt" 2> "$TMP/error.txt" || {
  cat "$TMP/error.txt" >&2
  exit 1
}
grep -q "Codex turn.completed=1" "$TMP/result.txt"
grep -q "Subagent creation NOT independently proven" "$TMP/result.txt"

# A cloned lookalike from another owner must never invoke an AI agent.
git -C "$FIXTURE" remote set-url origin https://github.com/other/Alfred-Laboratory.git
if (cd "$FIXTURE" && PATH="$TMP/bin:$PATH" bash scripts/pilot-codex-agents.sh --check) > "$TMP/remote.log" 2>&1; then
  echo "FAIL: unauthorized GitHub remote accepted" >&2
  exit 1
fi
grep -q "origin must point to BM000001/Alfred-Laboratory" "$TMP/remote.log"
git -C "$FIXTURE" remote set-url origin https://github.com/BM000001/Alfred-Laboratory.git

# A dirty checkout must not be analyzed by a real Codex invocation.
printf 'not committed\n' > "$FIXTURE/untracked-file"
if (cd "$FIXTURE" && PATH="$TMP/bin:$PATH" bash scripts/pilot-codex-agents.sh --run) > "$TMP/dirty.log" 2>&1; then
  echo "FAIL: dirty checkout accepted" >&2
  exit 1
fi
grep -q "checkout has changes/untracked files" "$TMP/dirty.log"
rm "$FIXTURE/untracked-file"

# An unrelated branch or detached checkout must not invoke the model.
git -C "$FIXTURE" checkout -q -b unrelated-experiment
if (cd "$FIXTURE" && PATH="$TMP/bin:$PATH" bash scripts/pilot-codex-agents.sh --run) > "$TMP/branch.log" 2>&1; then
  echo "FAIL: unapproved branch accepted" >&2
  exit 1
fi
grep -q "requires the approved pilot branch or main" "$TMP/branch.log"
git -C "$FIXTURE" checkout -q --detach HEAD
if (cd "$FIXTURE" && PATH="$TMP/bin:$PATH" bash scripts/pilot-codex-agents.sh --run) > "$TMP/detached.log" 2>&1; then
  echo "FAIL: detached checkout accepted" >&2
  exit 1
fi
grep -q "requires the approved pilot branch or main" "$TMP/detached.log"
echo "PASS: mock Codex invocation and repository/branch/dirty-tree fail-closed guards; no model invoked."
