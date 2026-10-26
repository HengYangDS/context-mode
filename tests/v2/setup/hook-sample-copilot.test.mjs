// D-HQ-COPILOT-EVENT-1: doctor hook-runs must send the copilot-cli payload the host really sends
// (docs.github.com/en/copilot/reference/hooks-configuration): no hookEventName, toolArgs a JSON string.
// A sample with a field the host never sends hid the live decode failure.
import { test } from "node:test";
import assert from "node:assert/strict";

import { hookSample } from "../../../src/setup/hook-sample.ts";

test("copilot-cli doctor sample is the documented postToolUse payload, with no hookEventName", () => {
  const { effect, payload } = hookSample("copilot-cli", "/tmp/proj", "x");
  assert.equal(effect, "replace");
  assert.equal("hookEventName" in payload, false);
  assert.equal("hook_event_name" in payload, false);
  assert.equal(typeof payload.toolArgs, "string");
  assert.deepEqual(JSON.parse(payload.toolArgs), { command: "cat big.log" });
  assert.deepEqual(payload.toolResult, { resultType: "success", textResultForLlm: "x" });
});
