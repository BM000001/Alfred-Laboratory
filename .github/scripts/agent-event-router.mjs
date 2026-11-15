#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";

const REPOSITORY = "BM000001/Alfred-Laboratory";
const PR_ACTIONS = new Set(["opened", "synchronize", "reopened", "closed", "ready_for_review", "converted_to_draft"]);
const ISSUE_ACTIONS = new Set(["opened", "reopened", "labeled", "unlabeled", "closed"]);

function labelsOf(items = []) {
  return items
    .map((item) => typeof item === "string" ? item : item?.name)
    .filter((name) => typeof name === "string" && name.length > 0)
    .slice(0, 20);
}

export function createEventEnvelope({
  eventName,
  payload = {},
  repository,
  ref = "",
  sha = "",
  runId = "",
  runAttempt = "",
}) {
  if (repository !== REPOSITORY) {
    throw new Error("Event routing is restricted to BM000001/Alfred-Laboratory.");
  }

  const action = typeof payload.action === "string" ? payload.action : null;
  let kind = "ignored";
  let subject = null;
  let occurredAt = null;

  if (eventName === "schedule") {
    kind = "scheduled_repository_review";
    subject = { scope: "repository_health" };
  } else if (eventName === "workflow_dispatch") {
    kind = "manual_repository_review";
    subject = { scope: "repository_health" };
  } else if (eventName === "pull_request_target" && PR_ACTIONS.has(action)) {
    const pr = payload.pull_request ?? {};
    kind = "pull_request_activity";
    subject = {
      number: Number.isInteger(pr.number) ? pr.number : null,
      state: typeof pr.state === "string" ? pr.state : null,
      draft: typeof pr.draft === "boolean" ? pr.draft : null,
      baseRef: typeof pr.base?.ref === "string" ? pr.base.ref : null,
      headRef: typeof pr.head?.ref === "string" ? pr.head.ref : null,
      headSha: typeof pr.head?.sha === "string" ? pr.head.sha : null,
      labels: labelsOf(pr.labels),
    };
    occurredAt = pr.updated_at ?? pr.created_at ?? null;
  } else if (eventName === "issues" && ISSUE_ACTIONS.has(action)) {
    const issue = payload.issue ?? {};
    kind = "issue_activity";
    subject = {
      number: Number.isInteger(issue.number) ? issue.number : null,
      state: typeof issue.state === "string" ? issue.state : null,
      labels: labelsOf(issue.labels),
    };
    occurredAt = issue.updated_at ?? issue.created_at ?? null;
  } else if (eventName === "workflow_run" && action === "completed") {
    const run = payload.workflow_run ?? {};
    kind = "ci_completed";
    subject = {
      id: Number.isInteger(run.id) ? run.id : null,
      name: typeof run.name === "string" ? run.name : null,
      conclusion: typeof run.conclusion === "string" ? run.conclusion : null,
      headBranch: typeof run.head_branch === "string" ? run.head_branch : null,
      headSha: typeof run.head_sha === "string" ? run.head_sha : null,
    };
    occurredAt = run.updated_at ?? run.created_at ?? null;
  }

  const identity = {
    repository,
    eventName,
    action,
    runId: String(runId),
    runAttempt: String(runAttempt),
    subject,
  };
  const id = createHash("sha256").update(JSON.stringify(identity)).digest("hex");

  return {
    schemaVersion: 1,
    id,
    status: kind === "ignored" ? "ignored" : "queued",
    kind,
    source: {
      repository,
      eventName,
      action,
      ref,
      sha,
      runId: String(runId),
      runAttempt: String(runAttempt),
    },
    occurredAt: typeof occurredAt === "string" ? occurredAt : null,
    subject,
    policy: {
      requiresHumanApprovalForWrites: true,
      modelExecution: "not_configured",
      includesIssueOrPullRequestBody: false,
    },
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function runSelfTests() {
  const base = {
    repository: REPOSITORY,
    ref: "refs/heads/develop-app",
    sha: "abc123",
    runId: "100",
    runAttempt: "1",
  };

  const scheduled = createEventEnvelope({
    ...base,
    eventName: "schedule",
    payload: {},
  });
  assert(scheduled.kind === "scheduled_repository_review", "schedule must create a repository review event");
  assert(scheduled.status === "queued", "supported events must be queued");

  const pr = createEventEnvelope({
    ...base,
    eventName: "pull_request_target",
    payload: {
      action: "opened",
      pull_request: {
        number: 42,
        state: "open",
        draft: false,
        body: "must not be copied",
        base: { ref: "develop-app" },
        head: { ref: "feature/example", sha: "def456" },
        labels: [{ name: "bug" }],
      },
    },
  });
  assert(pr.kind === "pull_request_activity", "pull request activity must be routed");
  assert(pr.subject.number === 42, "pull request number must be preserved");
  assert(!JSON.stringify(pr).includes("must not be copied"), "pull request body must not be included");
  assert(pr.policy.requiresHumanApprovalForWrites === true, "writes must require human approval");

  const issue = createEventEnvelope({
    ...base,
    eventName: "issues",
    payload: { action: "labeled", issue: { number: 7, state: "open", body: "private", labels: [{ name: "agent-task" }] } },
  });
  assert(issue.kind === "issue_activity", "issue activity must be routed");
  assert(!JSON.stringify(issue).includes("private"), "issue body must not be included");

  const ci = createEventEnvelope({
    ...base,
    eventName: "workflow_run",
    payload: { action: "completed", workflow_run: { id: 99, name: "Validate Alfred", conclusion: "success", head_branch: "develop-app", head_sha: "abc123" } },
  });
  assert(ci.kind === "ci_completed", "completed CI must be routed");

  const ignored = createEventEnvelope({
    ...base,
    eventName: "issues",
    payload: { action: "edited", issue: { number: 7 } },
  });
  assert(ignored.status === "ignored", "unsupported actions must be ignored");

  let rejected = false;
  try {
    createEventEnvelope({ ...base, repository: "BM000001/Alfred", eventName: "schedule", payload: {} });
  } catch {
    rejected = true;
  }
  assert(rejected, "the original Alfred repository must be rejected");

  return "Agent event router self-tests passed.";
}

async function main() {
  if (process.argv.includes("--self-test")) {
    process.stdout.write(runSelfTests() + "\n");
    return;
  }

  const eventPath = process.env.GITHUB_EVENT_PATH;
  const outputPath = process.env.ALFRED_EVENT_OUTPUT;
  if (!eventPath || !outputPath) {
    throw new Error("GITHUB_EVENT_PATH and ALFRED_EVENT_OUTPUT are required.");
  }

  const payload = JSON.parse(await readFile(eventPath, "utf8"));
  const envelope = createEventEnvelope({
    eventName: process.env.GITHUB_EVENT_NAME ?? "",
    payload,
    repository: process.env.GITHUB_REPOSITORY ?? "",
    ref: process.env.GITHUB_REF ?? "",
    sha: process.env.GITHUB_SHA ?? "",
    runId: process.env.GITHUB_RUN_ID ?? "",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? "",
  });

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(envelope, null, 2) + "\n", { mode: 0o600 });
  process.stdout.write("Wrote " + envelope.status + " event envelope (" + envelope.kind + ").\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(error.message + "\n");
    process.exitCode = 1;
  });
}
