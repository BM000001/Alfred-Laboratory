import test from "node:test";
import assert from "node:assert/strict";
import { classifyEvent } from "./alfred-agent-event-router.mjs";

const repo = "BM000001/Alfred-Laboratory";

test("routes a non-draft pull request to review specialists", () => {
  const result = classifyEvent("pull_request", {
    action: "opened",
    pull_request: {
      number: 42,
      title: "Improve navigation",
      body: "Simplify the menu",
      draft: false,
      html_url: "https://github.com/BM000001/Alfred-Laboratory/pull/42",
      head: { sha: "abc123" }
    }
  }, repo);
  assert.equal(result.ignored, false);
  assert.deepEqual(result.task.recommended_agents, ["explorer", "reviewer", "qa"]);
  assert.equal(result.task.permissions, "read-only");
  assert.equal(result.task.requires_human_approval, true);
  assert.equal(result.task.auto_merge, false);
});

test("adds security review when PR text indicates a security-sensitive change", () => {
  const result = classifyEvent("pull_request", {
    action: "synchronize",
    pull_request: {
      number: 43, title: "Improve token validation", body: "",
      draft: false, head: { sha: "def456" }
    }
  }, repo);
  assert.ok(result.task.recommended_agents.includes("security_reviewer"));
});

test("ignores draft pull requests", () => {
  const result = classifyEvent("pull_request", {
    action: "opened", pull_request: { number: 44, draft: true }
  }, repo);
  assert.equal(result.ignored, true);
  assert.equal(result.reason, "draft_pull_request");
});

test("routes failed workflow completion to QA and investigation", () => {
  const result = classifyEvent("workflow_run", {
    action: "completed",
    workflow_run: {
      id: 9001, name: "Validate Alfred", conclusion: "failure",
      head_sha: "sha9001", html_url: "https://github.com/example/run/9001"
    }
  }, repo);
  assert.equal(result.task.event_kind, "ci_failure_investigation");
  assert.ok(result.task.recommended_agents.includes("qa"));
});

test("ignores successful workflow completion", () => {
  const result = classifyEvent("workflow_run", {
    action: "completed", workflow_run: { id: 9002, conclusion: "success" }
  }, repo);
  assert.equal(result.ignored, true);
});

test("routes only explicitly labeled issues", () => {
  const result = classifyEvent("issues", {
    action: "labeled", label: { name: "agent:triage" },
    issue: { number: 7, title: "Review study planner", html_url: "https://example.test/issues/7" }
  }, repo);
  assert.equal(result.task.event_kind, "issue_triage");
  assert.deepEqual(result.task.recommended_agents, ["planner", "explorer"]);
});

test("ignores issues without an approved agent label", () => {
  const result = classifyEvent("issues", {
    action: "labeled", label: { name: "bug" }, issue: { number: 8 }
  }, repo);
  assert.equal(result.ignored, true);
});

test("ignores unselected event types", () => {
  assert.equal(classifyEvent("push", {}, repo).ignored, true);
});

test("refuses to route events from any other repository", () => {
  assert.throws(() => classifyEvent("pull_request", {}, "BM000001/Alfred"), /unauthorized repository/);
});

test("deduplicates retries for the same PR revision", () => {
  const payload = {
    action: "synchronize",
    pull_request: { number: 45, title: "Update", draft: false, head: { sha: "same-sha" } }
  };
  const first = classifyEvent("pull_request", payload, repo);
  const retry = classifyEvent("pull_request", payload, repo);
  assert.equal(first.task_id, retry.task_id);
});
