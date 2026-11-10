#!/usr/bin/env node
/**
 * Converts trusted GitHub repository events into bounded, read-only agent tasks.
 * This is a router/queue producer, not an AI executor.
 */
import { createHash } from "node:crypto";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const ALLOWED_REPOSITORY = "BM000001/Alfred-Laboratory";
const ISSUE_AGENT_LABELS = new Set(["agent:triage", "agent:investigate"]);
const PR_ACTIONS = new Set(["opened", "reopened", "synchronize", "ready_for_review"]);

function stableId(parts) {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);
}

function ignored(reason, eventName) {
  return { schema_version: 1, ignored: true, reason, source_event: eventName };
}

export function classifyEvent(eventName, payload, repository = ALLOWED_REPOSITORY) {
  if (repository !== ALLOWED_REPOSITORY) {
    throw new Error(`Refusing to route events from unauthorized repository: ${repository}`);
  }

  let task;
  if (eventName === "pull_request") {
    const pr = payload.pull_request ?? {};
    if (!PR_ACTIONS.has(payload.action)) return ignored("pull_request_action_not_selected", eventName);
    if (pr.draft) return ignored("draft_pull_request", eventName);
    const number = pr.number ?? payload.number ?? "unknown";
    const headSha = pr.head?.sha ?? "unknown";
    task = {
      event_kind: "pull_request_review",
      title: `Review pull request #${number}: ${pr.title ?? "untitled"}`,
      source_url: pr.html_url ?? null,
      source_number: number,
      source_revision: headSha,
      recommended_agents: ["explorer", "reviewer", "qa"],
      rationale: "A non-draft pull request was opened or updated."
    };
    const searchable = `${pr.title ?? ""} ${pr.body ?? ""}`.toLowerCase();
    if (/(security|auth|token|credential|crypto|privacy|permission)/.test(searchable)) {
      task.recommended_agents.push("security_reviewer");
    }
    task.dedupe_key = stableId([repository, eventName, payload.action, String(number), headSha]);
  } else if (eventName === "workflow_run") {
    const run = payload.workflow_run ?? {};
    if (payload.action !== "completed" || run.conclusion !== "failure") {
      return ignored("workflow_run_not_failed_completion", eventName);
    }
    task = {
      event_kind: "ci_failure_investigation",
      title: `Investigate failed workflow: ${run.name ?? "GitHub Actions"}`,
      source_url: run.html_url ?? null,
      source_number: run.id ?? null,
      source_revision: run.head_sha ?? null,
      recommended_agents: ["qa", "explorer", "reviewer"],
      rationale: "A GitHub Actions workflow completed with failure."
    };
    task.dedupe_key = stableId([repository, eventName, String(run.id ?? ""), String(run.head_sha ?? "")]);
  } else if (eventName === "issues") {
    if (payload.action !== "labeled") return ignored("issue_action_not_selected", eventName);
    const label = payload.label?.name ?? "";
    if (!ISSUE_AGENT_LABELS.has(label)) return ignored("issue_label_not_selected", eventName);
    const issue = payload.issue ?? {};
    const number = issue.number ?? payload.number ?? "unknown";
    task = {
      event_kind: "issue_triage",
      title: `Triage issue #${number}: ${issue.title ?? "untitled"}`,
      source_url: issue.html_url ?? null,
      source_number: number,
      source_revision: null,
      recommended_agents: ["planner", "explorer"],
      rationale: `An authorized triage label was added: ${label}.`
    };
    task.dedupe_key = stableId([repository, eventName, String(number), label]);
  } else {
    return ignored("event_type_not_selected", eventName);
  }

  return {
    schema_version: 1,
    ignored: false,
    task_id: task.dedupe_key,
    created_at: new Date().toISOString(),
    target_repository: ALLOWED_REPOSITORY,
    source_event: eventName,
    task: {
      ...task,
      execution_mode: "queued_proposal",
      permissions: "read-only",
      requires_human_approval: true,
      auto_merge: false,
      auto_deploy: false
    }
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--event-name") args.eventName = argv[++i];
    else if (argv[i] === "--event-path") args.eventPath = argv[++i];
    else if (argv[i] === "--output") args.output = argv[++i];
    else throw new Error(`Unknown argument: ${argv[i]}`);
  }
  if (!args.eventName || !args.eventPath || !args.output) {
    throw new Error("Usage: node alfred-agent-event-router.mjs --event-name <name> --event-path <path> --output <path>");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const payload = JSON.parse(await readFile(args.eventPath, "utf8"));
  const repository = process.env.GITHUB_REPOSITORY ?? payload.repository?.full_name ?? "";
  const result = classifyEvent(args.eventName, payload, repository);
  await writeFile(args.output, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });

  if (process.env.GITHUB_OUTPUT) {
    await appendFile(process.env.GITHUB_OUTPUT, `has_task=${result.ignored ? "false" : "true"}\n`);
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const summary = result.ignored
      ? `## Alfred event router\n\nIgnored: ${result.reason}\n`
      : [
          "## Alfred event router",
          "",
          `- **Task:** ${result.task.title}`,
          `- **Type:** ${result.task.event_kind}`,
          `- **Agents suggested:** ${result.task.recommended_agents.join(", ")}`,
          "- **Mode:** queued proposal (no AI execution)",
          "- **Permissions:** read-only",
          "- **Human approval:** required",
          `- **Source:** ${result.task.source_url ?? "not available"}`,
          "",
          "The task JSON is an artifact for review; no agent, merge, or deployment was started."
        ].join("\n") + "\n";
    await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  }
  process.stdout.write(`${JSON.stringify({ ignored: result.ignored, task_id: result.task_id ?? null })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`event-router: ${error.message}\n`);
    process.exitCode = 1;
  });
}
