// src/core/contracts/agents.ts
var AGENT_IDS = ["claude-code", "codex", "gemini", "qwen", "copilot-cli", "vscode", "kiro", "zcode", "pi", "opencode"];

// src/core/contracts/constants.ts
var SERVER_KEY = "context-mode";
var TOOL_ORDER = Object.freeze(["ctx_execute", "ctx_batch", "ctx_index", "ctx_search", "ctx_resume", "ctx_stats", "ctx_doctor", "ctx_upgrade", "ctx_purge"]);
var OUTPUT_CAP = 16384;
var STATE_BUDGET = 2048;
var REPORT_CAP = 4096;
var POINTER_MIN = 640;
var STATE_CLOSE_TAG = "</context_mode_state>";
var INDEX_WRITE_CHUNK = 1048576;
var SYNC_INDEX_MAX_BYTES = 65536;
var REPLACE_TRIGGER_BYTES = 4096;
var REPLACE_RETURN_BYTES = 96;
var REPLACE_CHUNK_BYTES = 48;
var MAX_CHUNK_BYTES = 4096;
var READ_MAX_LINES = 200;
var MAX_CANDIDATES = 85;
var MAX_CANDIDATES_TOTAL = 340;
var WEIGHT = Object.freeze({ toolerr: 900, decision: 700, prompt: 500, edit: 400, index: 200 });
var RATIO_SECTION_DECAY = 0.7;
var DECAY_X1000 = Object.freeze([
  1e3,
  881,
  780,
  696,
  625,
  565,
  515,
  473,
  438,
  408,
  383,
  361,
  344,
  329,
  316,
  306,
  297,
  289,
  283,
  278,
  273,
  270,
  267,
  264,
  262,
  260,
  258,
  257,
  256,
  255,
  254,
  253,
  253,
  252,
  252,
  252,
  251,
  251,
  251,
  251,
  251,
  251,
  251,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250,
  250
]);
var COMPACT_POINTER_LINE = 'context-mode: earlier work of this session is in ctx_resume (state block) and ctx_search(scope:"session", sort:"timeline").';
var DB_TIMEOUT_MS = 5e3;
var DB_WAL_SUFFIX = "-wal";
var DB_SHM_SUFFIX = "-shm";
var DB_TMP_SUFFIX = ".tmp";
var SQLITE_PRIMARY_CODE_MASK = 255;
var SQLITE_CORRUPT_CODE = 11;
var SQLITE_NOTADB_CODE = 26;
var HOOK_TIMEOUT_MS = 5e3;
var IN_PROCESS_TIMEOUT_MS = 0;
var PROJECT_KEY_HEX_LEN = 16;
var SCHEMA_VERSION = 2;
var PROJECTS_DIR_NAME = "projects";
var DB_FILE_NAME = "context.db";
var GIT_DIR_NAME = ".git";
var GIT_WORKTREE_LINE_PREFIX = "worktree ";
var GITDIR_FILE_PREFIX = "gitdir: ";
var GIT_COMMONDIR_FILE = "commondir";
var GIT_HEAD_FILE = "HEAD";
var WORKSPACE_FOLDER_FLAG = "--workspace-folder";
var EXEC_LANGUAGES = Object.freeze(["shell", "powershell", "javascript", "typescript", "python"]);
var SOURCE_LABEL_MAX_CHARS = 80;
var PLAIN_OUTPUT_ENV = Object.freeze({ NO_COLOR: "1", FORCE_COLOR: "0" });
var NODE_MIN = "24.15.0";
var DATA_ROOT = "~/.context-mode";
var REQUIRE_SECURITY_ENV = "CONTEXT_MODE_REQUIRE_SECURITY";
var HOST_CONFIG_DIR_NAME = ".claude";
var AGENTS_DIR_NAME = "agents";
var AGENT_FILE_EXT = ".md";
var HOST_PLUGINS_DIR_NAME = "plugins";
var INSTALLED_PLUGINS_FILE = "installed_plugins.json";
var PLUGIN_AGENT_SEPARATOR = ":";
var PLUGIN_KEY_SEPARATOR = "@";
var FRONTMATTER_FENCE = "---";
var FRONTMATTER_TOOLS_KEY = "tools";
var FRONTMATTER_DISALLOWED_KEY = "disallowedTools";
var MCP_SERVER_TOOL_PREFIX = "mcp__";
var MCP_NAME_JOIN = "__";
var GEMINI_MCP_PREFIX = "mcp_";
var GEMINI_NAME_EXTRA_CHARS = "_-.:";
var MCP_HINT_EVERY_DEFAULT = 10;
function readHintEvery(raw) {
  if (raw === void 0 || raw.trim() === "") return MCP_HINT_EVERY_DEFAULT;
  const n = Number(raw);
  return Number.isSafeInteger(n) && n > 0 ? n : MCP_HINT_EVERY_DEFAULT;
}
var MCP_HINT_EVERY = readHintEvery(process.env.CTX_MCP_HINT_EVERY);
var MAX_NEST_DEPTH = 32;
function READ_DENY_MESSAGE(path, size) {
  return `context-mode: this file is ${size} bytes, more than the ${OUTPUT_CAP} byte limit for one read. Pick one: read part of it with Read(file_path, offset, limit), for example limit ${READ_MAX_LINES}; or run code on it with ctx_execute(language, code, file="${path}"), which gives your code the path in CTX_FILE and returns only stdout, up to ${OUTPUT_CAP} bytes; or search it with a bounded command such as grep -n or tail.`;
}
var DENY_PREFIX = "context-mode: ";
var DENY_WHAT = Object.freeze({
  curl: "This curl/wget call",
  http: "This inline HTTP call",
  build: "This build command",
  webfetch: "WebFetch"
});
var DENY_WHAT_SUFFIX = " sends its body into the conversation.";
var DENY_RUN_HERE_LINE = "Run it here instead; the full output is indexed and only the part that matches your intent comes back.";
var DENY_TOOL_LABEL = "Tool: ";
var DENY_INTENT_DEFAULT = "state what you need";
var DENY_EXEC_TOOL = "ctx_execute";
var DENY_WEBFETCH_TOOLS = Object.freeze(["ctx_index", "ctx_search"]);
var USER_DENY_REASON_PREFIX = "Blocked by security policy: matches deny pattern ";
var POLICY_UNREADABLE_LINE = "context-mode: your deny rules could not be read. Fix: run ctx_doctor.";
var PARSE_ERROR_DENY_LINE = "context-mode: could not parse this command; it may be blocked by your own rules. Run it through ctx_execute instead.";
var BOUNDED_COMMANDS = Object.freeze(["pwd", "whoami", "uname", "id", "realpath", "ln"]);
var BOUNDED_GIT_SUBCOMMANDS = Object.freeze(["status"]);
var VERSION_PROBE_FLAGS = Object.freeze(["--version", "-v"]);
var BOUNDED_UNLESS_VERBOSE = Object.freeze(["cp", "mv", "rm"]);
var VERBOSE_FLAGS = Object.freeze(["-v", "--verbose"]);
var JQ_WHITELIST = Object.freeze({ identity: ".", length: "length", pipeLength: "| length", fieldSep: "." });
var TOOL_PREFIX_SLOT = "{prefix}";
var DENY_WEBFETCH_JOIN = ", then ";
var POLICY_UNREADABLE_WARNING = "context-mode: your deny rules could not be read, so they are not applied. Fix: run ctx_doctor.";
var NEVER_DENY_HOSTS = Object.freeze(["claude.ai", "claude.site", "claudeusercontent.com"]);
var CURL_COMMANDS = Object.freeze(["curl", "wget"]);
var CURL_SILENT_FLAGS = Object.freeze({ curl: { short: "s", long: "--silent" }, wget: { short: "q", long: "--quiet" } });
var CURL_VERBOSE_FLAGS = Object.freeze(["-v", "--verbose", "--trace", "--trace-ascii"]);
var CURL_DUMP_HEADER_FLAG = "-D";
var BUILD_COMMANDS = Object.freeze(["gradlew", "gradle", "mvnw", "mvn", "sbt"]);
var FETCH_CALL = "fetch(";
var FETCH_QUOTES = "'\"`";
var HTTP_SCHEME = "http";
var INLINE_HTTP_CALLS = Object.freeze(["requests.get(", "requests.post(", "requests.put(", "http.get(", "http.request("]);
var SHELL_DUMP_COMMANDS = Object.freeze(["cat", "head", "tail", "sed", "less", "jq", "bat", "more"]);
var DUMP_COUNT_COMMANDS = Object.freeze(["head", "tail"]);
var DUMP_COUNT_FLAGS = Object.freeze(["-n", "-c", "--lines", "--bytes"]);
var SED_COMMAND = "sed";
var SED_QUIET_FLAGS = Object.freeze(["-n", "--quiet", "--silent"]);
var JQ_COMMAND = "jq";
var READ_PATH_KEYS = Object.freeze(["file_path", "absolute_path", "path"]);
var OWN_TOOL_PREFIX = "ctx_";
var SHELL_TOOL = "Bash";
var EDIT_TOOLS = Object.freeze(["Write", "Edit"]);
var EDIT_PATH_KEYS = Object.freeze(["file_path", "path"]);
var EXIT_CODE_LINE_PREFIX = "Exit code ";
var RESUME_HINT_KEY = "resume-hint";
var COMPACT_STATE_KEY = "compact-state";
var PENDING_COMPACT_KEY = "pending-compact";
var PENDING_COMPACT_META_PREFIX = "pending_compact:";
var PENDING_COMPACT_FLAG = "1";
var RECALL_BUDGET_BYTES = 2048;
var RECALL_MIN_SCORE = 5;
var RECALL_MAX_ROWS = 340;
var COMPACTED_META_PREFIX = "compacted:";
var RECALL_SEEN_META_PREFIX = "recall_seen:";
var RECALL_OPEN_TAG = "<context_mode_recall>";
var RECALL_CLOSE_TAG = "</context_mode_recall>";
var RECALL_KEY = "recall";
var RESUME_HINT = "This session may have run before. Call {prefix}ctx_resume for a summary of what happened.";
var SUBAGENT_SOURCE_PREFIX = "subagent:";
var RUN_WRAPPER_FILE = "run.mjs";
var RUN_WRAPPER_NODE = "node";
var SUBAGENT_RUN_DENY = "context-mode: This command sends its body into the conversation.\nRun the command on the line above with Bash instead. It runs the same command in the same folder, indexes the full output and prints only the part that matches your intent, with the same exit code.";
var AGENT_ARG = "--agent";
var DECAY_SCALE = 1e3;
var STATS_COLUMNS = Object.freeze(["Scope", "Produced", "Returned", "Saved", "Reduction %"]);
var PURGE_SCOPES = Object.freeze(["session", "source", "project"]);
var DECISION_SOURCE = "decision";
var DECISION_TOOL = "AskUserQuestion";
var DECISION_ANSWERS_KEY = "answers";
var DECISION_OPTION_KEY = "option";
var DECISION_LABEL_JOIN = " | ";
var DOCTOR_CHECK_ORDER = Object.freeze(["D1", "D2", "D3", "D4", "D5", "D5b", "D6", "D7", "D8", "D9", "D10"]);
var DOCTOR_LABEL = Object.freeze({
  D1: "version",
  D2: "node",
  D3: "host config",
  D4: "v1 leftovers",
  D5: "hook round trip",
  D5b: "double-fire",
  D6: "MCP",
  D7: "project and worktree",
  D8: "context.db",
  D9: "index",
  D10: "enforcement mode"
});
var REPORT_TRUNCATED_LINE = `(report truncated at ${REPORT_CAP} B; run ctx_doctor again after the first fix)`;
var D2_NODE_FIX = `install Node ${NODE_MIN} or later`;
var D3_PARTS = Object.freeze(["MCP entry", "hook entries", "hook timeout"]);
var AGENT_HOME_DIR = Object.freeze({
  "claude-code": [".claude"],
  codex: [".codex"],
  gemini: [".gemini"],
  qwen: [".qwen"],
  "copilot-cli": [".copilot"],
  vscode: [".vscode"],
  kiro: [".kiro"],
  zcode: [".zcode"],
  pi: [".pi"],
  opencode: [".config", "opencode"]
});
var UPGRADE_MODES = Object.freeze(["upgrade", "uninstall"]);
var GIT_CLONE_ARGS = Object.freeze(["clone", "--depth", "1", "--branch"]);
var GIT_HEAD_SHA_ARGS = Object.freeze(["rev-parse", "HEAD"]);
var UPGRADE_GIT_CHECKOUT_AGENTS = Object.freeze(["pi", "opencode"]);
var GIT_NO_PROMPT_ENV = Object.freeze({ GIT_TERMINAL_PROMPT: "0" });
var GIT_NO_CRLF_ENV = Object.freeze({ GIT_CONFIG_COUNT: "1", GIT_CONFIG_KEY_0: "core.autocrlf", GIT_CONFIG_VALUE_0: "false" });
var OPS_SPLIT_FILES = Object.freeze([
  "doctor-env.ts",
  "doctor-config.ts",
  "doctor-hook.ts",
  "doctor-db.ts",
  "doctor-heal.ts",
  "release-fetch.ts",
  "verify-sums.ts",
  "plugin-swap.ts",
  "host-write.ts",
  "v1-remove.ts",
  "uninstall.ts"
]);
var HOOK_HOST_FILE = Object.freeze({
  "claude-code": { root: "plugin", file: ["hooks", "claude-code.json"], key: ["hooks"], shape: "nested", timeoutKey: "timeout", matcher: true },
  codex: { root: "home", file: [".codex", "hooks.json"], key: ["hooks"], shape: "nested", timeoutKey: "timeout", matcher: true },
  gemini: { root: "home", file: [".gemini", "settings.json"], key: ["hooks"], shape: "nested", timeoutKey: "timeout", matcher: false },
  qwen: { root: "home", file: [".qwen", "settings.json"], key: ["hooks"], shape: "nested", timeoutKey: "timeout", matcher: true },
  "copilot-cli": { root: "home", file: [".copilot", "hooks", "context-mode.json"], key: ["hooks"], shape: "flat", timeoutKey: "timeoutSec", matcher: false },
  vscode: { root: "project", file: [".github", "hooks", "context-mode.json"], key: ["hooks"], shape: "flat", timeoutKey: "timeout", matcher: false },
  kiro: { root: "home", file: [".kiro", "hooks", "context-mode.json"], key: ["hooks"], shape: "kiro", timeoutKey: "timeout", matcher: false },
  zcode: { root: "home", file: [".zcode", "cli", "config.json"], key: ["hooks", "events"], shape: "zcode", timeoutKey: "timeoutMs", matcher: true },
  pi: null,
  opencode: null
});
var TOOL_HOOK_EVENTS = Object.freeze(["PreToolUse", "PostToolUse"]);
var CODEX_FEATURES_HOOKS_KEY = Object.freeze(["features", "hooks"]);
var DB_SIBLING_SUFFIXES = Object.freeze(["", DB_WAL_SUFFIX, DB_SHM_SUFFIX]);
var UPGRADE_HOST_COMMAND = Object.freeze({
  "claude-code": "claude plugin marketplace update context-mode && claude plugin update context-mode@context-mode",
  codex: "rewrite config.toml's [mcp_servers.context-mode*] block to the v2 entry, then restart Codex",
  gemini: "gemini extensions install https://github.com/mksglu/context-mode --ref release --auto-update",
  qwen: "qwen extensions install https://github.com/mksglu/context-mode --ref release --auto-update"
});
var V1_SCRIPT_NAMES = Object.freeze([
  "afteragentresponse.mjs",
  "aftermodel.mjs",
  "aftertool.mjs",
  "agentspawn.mjs",
  "beforeagent.mjs",
  "beforetool.mjs",
  "posttooluse.mjs",
  "precompact.mjs",
  "precompress.mjs",
  "pretooluse.mjs",
  "sessionend.mjs",
  "sessionstart.mjs",
  "stop.mjs",
  "userpromptsubmit.mjs"
]);
var V1_CODEX_HOOKS_DIR = Object.freeze(["hooks", "codex"]);
var V1_CACHE_HEAL_EXTS = Object.freeze([".mjs", ".sh"]);
var KIRO_AGENT_FILE = Object.freeze(["agents", "default.json"]);
var KIRO_STEERING_FILE = Object.freeze(["steering", "KIRO.md"]);
var OPENCODE_CONFIG_FILES = Object.freeze(["opencode.jsonc", "opencode.json"]);
var V1_DATA_ROOT_ENTRIES = Object.freeze(["content", "platform.json"]);
var PI_ROLE = "custom";
var V1_PATH_SEPS = Object.freeze(["/", "\\"]);
var V1_REASON = Object.freeze({
  hook: "v1 hook entry: command contains context-mode and a v1 script name or context-mode hook",
  cacheHealHook: "v1 cache-heal SessionStart hook entry",
  cacheHealFile: "v1 cache-heal script file",
  statusLine: "v1 statusLine (context-mode statusline): report only, never removed",
  mcpEntry: "v1 MCP entry mcpServers.context-mode",
  codexHook: "v1 Codex hook entry: context-mode hook codex or hooks/codex/*.mjs",
  codexToml: "v1 config.toml [mcp_servers.context-mode*] section",
  hookFile: "v1 hook file context-mode.json (runs context-mode hook)",
  vscodeMcp: "v1 MCP entry servers.context-mode in .vscode/mcp.json: report only, never removed",
  kiroHook: "v1 Kiro flat hook entry: command contains context-mode and a v1 script name or context-mode hook",
  kiroAgentFile: "v1 Kiro agent file agents/*.json with name context-mode",
  kiroSteering: "v1 Kiro steering doc .kiro/steering/KIRO.md: manual review, report only, never removed",
  piNpm: "v1 Pi package npm:context-mode",
  opencodePlugin: "v1 OpenCode plugin spec context-mode",
  zcodeHook: "v1 ZCode hook entry: command contains context-mode hook",
  dataDir: "v1 data dir <agent home>/context-mode/",
  dataDirShared: "v1 data dir ~/.gemini/context-mode/: delete only after a prompt (Antigravity shares it)",
  dataRoot: "v1 content under ~/.context-mode/",
  tmpFile: "v1 temp file context-mode-* under the OS temp dir"
});
var UPGRADE_REPORT_ONLY_REASONS = Object.freeze([V1_REASON.statusLine, V1_REASON.vscodeMcp, V1_REASON.dataDirShared, V1_REASON.tmpFile, V1_REASON.kiroSteering]);
var OPENCODE_TOOL_PREFIX = SERVER_KEY + "_";
var OWN_MCP_ENTRY = Object.freeze({
  codex: { file: [".codex", "config.toml"], key: ["mcp_servers", SERVER_KEY] },
  vscode: { file: [".vscode", "mcp.json"], key: ["servers", SERVER_KEY] },
  kiro: { file: [".kiro", "settings", "mcp.json"], key: ["mcpServers", SERVER_KEY] },
  zcode: { file: [".zcode", "cli", "config.json"], key: ["mcpServers", SERVER_KEY] }
});
var REPORT_ENV_ENUMS = Object.freeze({
  NODE_ENV: Object.freeze(["development", "production", "test"])
});

// src/core/hooks/dispatch.ts
import { dirname as dirname3, join as join5 } from "node:path";

// src/adapters/claude-code.ts
var TOOL_NAME_PREFIX = "mcp__plugin_context-mode_context-mode__";
var CLAUDE_SHAPE_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse"];
var MCP_PREFIX = "mcp__";
var MCP_SEP = "__";
var CLAUDE_SOURCES = { startup: "startup", resume: "resume", clear: "clear", compact: "compact" };
function canonicalName(name, ownPrefix) {
  if (name.startsWith(ownPrefix)) return name.slice(ownPrefix.length);
  if (!name.startsWith(MCP_PREFIX)) return name;
  const rest = name.slice(MCP_PREFIX.length);
  const sep3 = rest.indexOf(MCP_SEP);
  if (sep3 < 0) return name;
  return "mcp:" + rest.slice(0, sep3) + ":" + rest.slice(sep3 + MCP_SEP.length);
}
function outputOf(resp) {
  if (resp === void 0) return "";
  if (typeof resp === "string") return resp;
  if (typeof resp === "object" && resp !== null) {
    const r = resp;
    if (typeof r.stdout === "string" || typeof r.stderr === "string") {
      const out = typeof r.stdout === "string" ? r.stdout : "";
      const err = typeof r.stderr === "string" ? r.stderr : "";
      return err === "" ? out : out === "" ? err : out + "\n" + err;
    }
  }
  return JSON.stringify(resp);
}
function readResult(resp) {
  const text = outputOf(resp);
  const isError = typeof resp === "object" && resp !== null && resp.is_error === true;
  return { isError, bytes: Buffer.byteLength(text), text };
}
function decodeClaudeShape(raw, agent, ownPrefix, sources) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error(agent + ": hook payload is not a JSON object");
  const p = raw;
  const event = CLAUDE_SHAPE_EVENTS.find((e) => e === p.hook_event_name);
  if (event === void 0) throw new Error(agent + ": unknown hook event " + String(p.hook_event_name));
  const ev = { event, agent, sessionId: String(p.session_id ?? ""), cwd: String(p.cwd ?? "") };
  if (typeof p.agent_id === "string") {
    ev.agentId = p.agent_id;
    if (typeof p.agent_type === "string") ev.agentType = p.agent_type;
  }
  if (event === "SessionStart" && typeof p.source === "string" && sources[p.source] !== void 0) ev.source = sources[p.source];
  if (event === "UserPromptSubmit" && typeof p.prompt === "string") ev.prompt = p.prompt;
  if (event === "PreToolUse" || event === "PostToolUse") {
    const name = String(p.tool_name ?? "");
    const input = typeof p.tool_input === "object" && p.tool_input !== null ? p.tool_input : {};
    const tool = { name, canonicalName: canonicalName(name, ownPrefix), input };
    if (typeof p.tool_use_id === "string" && p.tool_use_id !== "") tool.callId = p.tool_use_id;
    ev.tool = tool;
  }
  if (event === "PostToolUse") ev.result = readResult(p.tool_response);
  return ev;
}
function replaceShape(ev, output) {
  return ev.tool?.canonicalName === "Bash" ? { stdout: output, stderr: "", interrupted: false } : output;
}
function encodeClaudeShape(ev, d, hasReplace2) {
  const out = (fields) => ({
    stdout: JSON.stringify({ hookSpecificOutput: { hookEventName: ev.event, ...fields } }),
    exitCode: 0
  });
  switch (d.kind) {
    case "allow":
      return { stdout: "", exitCode: 0 };
    case "hint":
      return out({ additionalContext: d.text });
    case "deny":
      return out({ permissionDecision: "deny", permissionDecisionReason: d.rewritten === void 0 ? d.reason : d.rewritten + "\n" + d.reason });
    case "replace":
      return hasReplace2 && ev.event === "PostToolUse" ? out({ updatedToolOutput: replaceShape(ev, d.output) }) : { stdout: "", exitCode: 0 };
  }
}
var REQUIRED_FIELDS = {
  PreToolUse: ["tool_name"],
  PostToolUse: ["tool_name", "tool_response"]
};
function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
function requireFields(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return;
  const p = raw;
  if (p.hook_event_name === void 0) throw new Error("claude-code: missing required field hook_event_name");
  for (const f of REQUIRED_FIELDS[p.hook_event_name] ?? []) {
    if (p[f] === void 0) throw new Error("claude-code: missing required field " + f);
  }
}
function decode(raw) {
  requireFields(raw);
  const ev = decodeClaudeShape(raw, "claude-code", TOOL_NAME_PREFIX, CLAUDE_SOURCES);
  if (ev.cwd === "") ev.cwd = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  if (ev.event === "PostToolUse" && ev.tool !== void 0 && ev.tool.callId === void 0) {
    const cmd = typeof ev.tool.input.command === "string" ? ev.tool.input.command : JSON.stringify(ev.tool.input);
    ev.tool.callId = "h" + fnv1a(ev.tool.name + "\0" + cmd + "\0" + String(ev.turn ?? 0));
  }
  return ev;
}
function encode(ev, d, _extra) {
  return encodeClaudeShape(ev, d, true);
}

// src/adapters/codex.ts
var TOOL_NAME_PREFIX2 = "mcp__context_mode__";
var CODEX_SOURCES = { startup: "startup", resume: "resume", clear: "clear", compact: "compact", fork: "resume" };
function decode2(raw) {
  return decodeClaudeShape(raw, "codex", TOOL_NAME_PREFIX2, CODEX_SOURCES);
}
function encode2(ev, d, _extra) {
  return encodeClaudeShape(ev, d, false);
}

// src/adapters/gemini.ts
var TOOL_NAME_PREFIX3 = "mcp_context-mode_";
var GEMINI_EVENTS = {
  SessionStart: "SessionStart",
  BeforeAgent: "UserPromptSubmit",
  BeforeTool: "PreToolUse",
  AfterTool: "PostToolUse",
  PreCompress: "PreCompact"
};
var GEMINI_SOURCES = { startup: "startup", resume: "resume", clear: "clear" };
var HINT_EVENTS = ["SessionStart", "UserPromptSubmit", "PostToolUse"];
var DENY_EVENTS = ["UserPromptSubmit", "PreToolUse"];
var EMPTY = { stdout: "", exitCode: 0 };
function own(p, key) {
  return Object.hasOwn(p, key) ? p[key] : void 0;
}
function canonicalName2(name, mcp) {
  if (name.startsWith(TOOL_NAME_PREFIX3)) return name.slice(TOOL_NAME_PREFIX3.length);
  if (typeof mcp !== "object" || mcp === null) return name;
  const m = mcp;
  const server = own(m, "server_name");
  const tool = own(m, "tool_name");
  if (typeof server !== "string" || typeof tool !== "string") return name;
  return "mcp:" + server + ":" + tool;
}
function readResult2(resp) {
  const text = resp === void 0 ? "" : typeof resp === "string" ? resp : JSON.stringify(resp);
  const err = typeof resp === "object" && resp !== null ? own(resp, "error") : void 0;
  return { isError: err !== void 0 && err !== null, bytes: Buffer.byteLength(text), text };
}
function decode3(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("gemini: hook payload is not a JSON object");
  const p = raw;
  const native = own(p, "hook_event_name");
  const event = typeof native === "string" && Object.hasOwn(GEMINI_EVENTS, native) ? GEMINI_EVENTS[native] : void 0;
  if (event === void 0) throw new Error("gemini: unknown hook event " + String(native));
  const ev = { event, agent: "gemini", sessionId: String(own(p, "session_id") ?? ""), cwd: String(own(p, "cwd") ?? "") };
  const source = own(p, "source");
  if (event === "SessionStart" && typeof source === "string" && Object.hasOwn(GEMINI_SOURCES, source)) ev.source = GEMINI_SOURCES[source];
  const prompt = own(p, "prompt");
  if (event === "UserPromptSubmit" && typeof prompt === "string") ev.prompt = prompt;
  if (event === "PreToolUse" || event === "PostToolUse") {
    const name = String(own(p, "tool_name") ?? "");
    const input = own(p, "tool_input");
    ev.tool = {
      name,
      canonicalName: canonicalName2(name, own(p, "mcp_context")),
      input: typeof input === "object" && input !== null && !Array.isArray(input) ? input : {}
    };
  }
  if (event === "PostToolUse") ev.result = readResult2(own(p, "tool_response"));
  return ev;
}
function encode3(ev, d, _extra) {
  switch (d.kind) {
    case "allow":
      return EMPTY;
    case "hint":
      if (!HINT_EVENTS.includes(ev.event)) return EMPTY;
      return { stdout: JSON.stringify({ hookSpecificOutput: { additionalContext: d.text } }), exitCode: 0 };
    case "deny":
      if (!DENY_EVENTS.includes(ev.event)) return EMPTY;
      return { stdout: JSON.stringify({ decision: "deny", reason: d.rewritten === void 0 ? d.reason : d.rewritten + "\n" + d.reason }), exitCode: 0 };
    case "replace":
      return EMPTY;
  }
}

// src/adapters/qwen.ts
var TOOL_NAME_PREFIX4 = "mcp__context-mode__";
var QWEN_SOURCES = { startup: "startup", resume: "resume", clear: "clear", compact: "compact" };
var NATIVE_TO_CANONICAL = {
  run_shell_command: "Bash",
  Shell: "Bash",
  read_file: "Read",
  grep_search: "Grep",
  web_fetch: "WebFetch"
};
var FAILURE_EVENT = "PostToolUseFailure";
function decode4(raw) {
  const failure = typeof raw === "object" && raw !== null && !Array.isArray(raw) && raw.hook_event_name === FAILURE_EVENT;
  const payload = failure ? { ...raw, hook_event_name: "PostToolUse" } : raw;
  const ev = decodeClaudeShape(payload, "qwen", TOOL_NAME_PREFIX4, QWEN_SOURCES);
  if (ev.tool !== void 0 && Object.hasOwn(NATIVE_TO_CANONICAL, ev.tool.name)) ev.tool.canonicalName = NATIVE_TO_CANONICAL[ev.tool.name];
  if (failure) {
    const error = raw.error;
    const text = typeof error === "string" ? error : error === void 0 ? "" : JSON.stringify(error);
    ev.result = { isError: true, bytes: Buffer.byteLength(text), text };
  }
  return ev;
}
function encode4(ev, d, _extra) {
  return encodeClaudeShape(ev, d, false);
}

// src/adapters/copilot-cli.ts
var TOOL_NAME_PREFIX5 = "mcp_context-mode_";
var NATIVE_EVENTS = {
  sessionStart: { event: "SessionStart", casing: "camel", failure: false },
  userPromptSubmitted: { event: "UserPromptSubmit", casing: "camel", failure: false },
  preToolUse: { event: "PreToolUse", casing: "camel", failure: false },
  postToolUse: { event: "PostToolUse", casing: "camel", failure: false },
  postToolUseFailure: { event: "PostToolUse", casing: "camel", failure: true },
  SessionStart: { event: "SessionStart", casing: "snake", failure: false },
  UserPromptSubmit: { event: "UserPromptSubmit", casing: "snake", failure: false },
  PreToolUse: { event: "PreToolUse", casing: "snake", failure: false },
  PostToolUse: { event: "PostToolUse", casing: "snake", failure: false },
  PostToolUseFailure: { event: "PostToolUse", casing: "snake", failure: true }
};
var COPILOT_SOURCES = { startup: "startup", resume: "resume", new: "startup" };
var KEYS = {
  camel: { event: "hookEventName", session: "sessionId", tool: "toolName", args: "toolArgs", result: "toolResult" },
  snake: { event: "hook_event_name", session: "session_id", tool: "tool_name", args: "tool_input", result: "tool_response" }
};
var MCP_PREFIX2 = "mcp_";
var MCP_SEP2 = "_";
var RESULT_SUCCESS = "success";
function isRecord(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function canonicalName3(name) {
  if (name.startsWith(TOOL_NAME_PREFIX5)) return name.slice(TOOL_NAME_PREFIX5.length);
  if (!name.startsWith(MCP_PREFIX2)) return name;
  const rest = name.slice(MCP_PREFIX2.length);
  const sep3 = rest.indexOf(MCP_SEP2);
  if (sep3 < 0) return name;
  return "mcp:" + rest.slice(0, sep3) + ":" + rest.slice(sep3 + MCP_SEP2.length);
}
function readArgs(v) {
  if (isRecord(v)) return v;
  if (typeof v !== "string") return {};
  try {
    const parsed = JSON.parse(v);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}
function readResult3(v, casing, failure) {
  if (casing === "camel") {
    const r = isRecord(v) ? v : {};
    const text2 = typeof r.textResultForLlm === "string" ? r.textResultForLlm : "";
    const isError2 = failure || typeof r.resultType === "string" && r.resultType !== RESULT_SUCCESS;
    return { isError: isError2, bytes: Buffer.byteLength(text2), text: text2 };
  }
  const text = v === void 0 ? "" : typeof v === "string" ? v : JSON.stringify(v);
  const isError = failure || isRecord(v) && v.is_error === true;
  return { isError, bytes: Buffer.byteLength(text), text };
}
function decode5(raw) {
  if (!isRecord(raw)) throw new Error("copilot-cli: hook payload is not a JSON object");
  const name = typeof raw.hookEventName === "string" ? raw.hookEventName : raw.hook_event_name;
  const native = typeof name === "string" ? NATIVE_EVENTS[name] : void 0;
  if (native === void 0) throw new Error("copilot-cli: unknown hook event " + String(name));
  const k = KEYS[native.casing];
  const event = native.event;
  const ev = { event, agent: "copilot-cli", sessionId: String(raw[k.session] ?? ""), cwd: String(raw.cwd ?? "") };
  if (event === "SessionStart" && typeof raw.source === "string" && COPILOT_SOURCES[raw.source] !== void 0) ev.source = COPILOT_SOURCES[raw.source];
  if (event === "UserPromptSubmit" && typeof raw.prompt === "string") ev.prompt = raw.prompt;
  if (event === "PreToolUse" || event === "PostToolUse") {
    const toolName = String(raw[k.tool] ?? "");
    const tool = { name: toolName, canonicalName: canonicalName3(toolName), input: readArgs(raw[k.args]) };
    ev.tool = tool;
  }
  if (event === "PostToolUse") ev.result = readResult3(raw[k.result], native.casing, native.failure);
  return ev;
}
var EMPTY2 = { stdout: "", exitCode: 0 };
function encode5(ev, d, _extra) {
  switch (d.kind) {
    case "allow":
      return EMPTY2;
    case "hint":
      return ev.event === "PostToolUse" ? EMPTY2 : { stdout: JSON.stringify({ additionalContext: d.text }), exitCode: 0 };
    case "deny":
      if (ev.event !== "PreToolUse") return EMPTY2;
      return {
        stdout: JSON.stringify({ permissionDecision: "deny", permissionDecisionReason: d.rewritten === void 0 ? d.reason : d.rewritten + "\n" + d.reason }),
        exitCode: 0
      };
    case "replace":
      return EMPTY2;
  }
}

// src/adapters/vscode.ts
var TOOL_NAME_PREFIX6 = "mcp_context-mode_";
var VSCODE_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "PreCompact"];
var MCP_PREFIX3 = "mcp_";
var MCP_SEP3 = "_";
var SESSION_START_NEW = "new";
function canonicalName4(name) {
  if (name.startsWith(TOOL_NAME_PREFIX6)) return name.slice(TOOL_NAME_PREFIX6.length);
  if (!name.startsWith(MCP_PREFIX3)) return name;
  const rest = name.slice(MCP_PREFIX3.length);
  const sep3 = rest.indexOf(MCP_SEP3);
  if (sep3 <= 0 || sep3 === rest.length - 1) return name;
  return "mcp:" + rest.slice(0, sep3) + ":" + rest.slice(sep3 + MCP_SEP3.length);
}
function readResult4(resp) {
  const text = resp === void 0 ? "" : typeof resp === "string" ? resp : JSON.stringify(resp);
  const isError = typeof resp === "object" && resp !== null && resp.is_error === true;
  return { isError, bytes: Buffer.byteLength(text), text };
}
function decode6(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("vscode: hook payload is not a JSON object");
  const p = raw;
  const event = VSCODE_EVENTS.find((e) => e === p.hook_event_name);
  if (event === void 0) throw new Error("vscode: unknown hook event " + String(p.hook_event_name));
  const ev = { event, agent: "vscode", sessionId: String(p.session_id ?? ""), cwd: String(p.cwd ?? "") };
  if (event === "SessionStart" && p.source === SESSION_START_NEW) ev.source = "startup";
  if (event === "UserPromptSubmit" && typeof p.prompt === "string") ev.prompt = p.prompt;
  if (event === "PreToolUse" || event === "PostToolUse") {
    const name = String(p.tool_name ?? "");
    const input = typeof p.tool_input === "object" && p.tool_input !== null && !Array.isArray(p.tool_input) ? p.tool_input : {};
    ev.tool = { name, canonicalName: canonicalName4(name), input };
  }
  if (event === "PostToolUse") ev.result = readResult4(p.tool_response);
  return ev;
}
function encode6(ev, d, _extra) {
  return encodeClaudeShape(ev, d, false);
}

// src/adapters/kiro.ts
var TOOL_NAME_PREFIX7 = "mcp_context-mode_";
var KIRO_EVENTS = {
  SessionStart: "SessionStart",
  agentSpawn: "SessionStart",
  UserPromptSubmit: "UserPromptSubmit",
  PromptSubmit: "UserPromptSubmit",
  userPromptSubmit: "UserPromptSubmit",
  PreToolUse: "PreToolUse",
  PostToolUse: "PostToolUse"
};
var PROMPT_ENV = "USER_PROMPT";
var MCP_PREFIX4 = "mcp_";
var MCP_SEP4 = "_";
var KIRO_SOURCES = { startup: "startup", resume: "resume", clear: "clear", compact: "compact" };
function canonicalName5(name) {
  if (name.startsWith(TOOL_NAME_PREFIX7)) return name.slice(TOOL_NAME_PREFIX7.length);
  if (!name.startsWith(MCP_PREFIX4)) return name;
  const rest = name.slice(MCP_PREFIX4.length);
  const sep3 = rest.indexOf(MCP_SEP4);
  if (sep3 <= 0 || sep3 === rest.length - 1) return name;
  return "mcp:" + rest.slice(0, sep3) + ":" + rest.slice(sep3 + MCP_SEP4.length);
}
function readResult5(resp) {
  const text = resp === void 0 ? "" : typeof resp === "string" ? resp : JSON.stringify(resp);
  return { isError: false, bytes: Buffer.byteLength(text), text };
}
function decode7(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("kiro: hook payload is not a JSON object");
  const p = raw;
  const native = typeof p.hook_event_name === "string" ? p.hook_event_name : "";
  const event = Object.prototype.hasOwnProperty.call(KIRO_EVENTS, native) ? KIRO_EVENTS[native] : void 0;
  if (event === void 0) throw new Error("kiro: unknown hook event " + String(p.hook_event_name));
  const ev = { event, agent: "kiro", sessionId: String(p.session_id ?? ""), cwd: String(p.cwd ?? "") };
  if (event === "SessionStart" && typeof p.source === "string" && KIRO_SOURCES[p.source] !== void 0) ev.source = KIRO_SOURCES[p.source];
  if (event === "UserPromptSubmit") {
    const prompt = process.env[PROMPT_ENV];
    if (prompt !== void 0) ev.prompt = prompt;
  }
  if (event === "PreToolUse" || event === "PostToolUse") {
    const name = String(p.tool_name ?? "");
    const input = typeof p.tool_input === "object" && p.tool_input !== null && !Array.isArray(p.tool_input) ? p.tool_input : {};
    ev.tool = { name, canonicalName: canonicalName5(name), input };
  }
  if (event === "PostToolUse") ev.result = readResult5(p.tool_response);
  return ev;
}
function encode7(ev, d, _extra) {
  if (ev.event === "UserPromptSubmit") return { stdout: "", exitCode: 0 };
  switch (d.kind) {
    case "allow":
      return { stdout: "", exitCode: 0 };
    case "hint":
      return { stdout: d.text, exitCode: 0 };
    case "deny":
      return { stdout: d.rewritten === void 0 ? d.reason : d.rewritten + "\n" + d.reason, exitCode: 2 };
    case "replace":
      return { stdout: "", exitCode: 0 };
  }
}

// src/adapters/zcode.ts
var TOOL_NAME_PREFIX8 = "mcp__context-mode__";
var ZCODE_SOURCES = { startup: "startup", resume: "resume", clear: "clear", compact: "compact" };
var TWINS = { hook_event_name: "hookEventName", session_id: "sessionId" };
var FAILURE_EVENT2 = "PostToolUseFailure";
function decode8(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("zcode: hook payload is not a JSON object");
  const p = { ...raw };
  for (const [snake, camel] of Object.entries(TWINS)) if (p[snake] === void 0) p[snake] = p[camel];
  const failure = p.hook_event_name === FAILURE_EVENT2;
  if (failure) p.hook_event_name = "PostToolUse";
  const ev = decodeClaudeShape(p, "zcode", TOOL_NAME_PREFIX8, ZCODE_SOURCES);
  if (failure) {
    const text = typeof p.error === "string" ? p.error : p.error === void 0 ? "" : JSON.stringify(p.error);
    ev.result = { isError: true, bytes: Buffer.byteLength(text), text };
  }
  return ev;
}
function encode8(ev, d, _extra) {
  return encodeClaudeShape(ev, d, false);
}

// src/adapters/pi.ts
var TOOL_NAME_PREFIX9 = "";
var PI_EVENTS = {
  session_start: { event: "SessionStart", source: "startup" },
  session_compact: { event: "SessionStart", source: "compact" },
  input: { event: "UserPromptSubmit" },
  tool_call: { event: "PreToolUse" },
  tool_result: { event: "PostToolUse" }
};
function record(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? v : {};
}
function readResult6(p) {
  const text = p.content === void 0 ? "" : typeof p.content === "string" ? p.content : JSON.stringify(p.content);
  const info = { isError: p.isError === true, bytes: Buffer.byteLength(text), text };
  if (typeof p.exitCode === "number") info.exitCode = p.exitCode;
  return info;
}
function decode9(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("pi: hook payload is not an object");
  const p = raw;
  const native = typeof p.type === "string" ? p.type : "";
  const row = Object.prototype.hasOwnProperty.call(PI_EVENTS, native) ? PI_EVENTS[native] : void 0;
  if (row === void 0) throw new Error("pi: unknown hook event " + String(p.type));
  const ev = { event: row.event, agent: "pi", sessionId: String(p.sessionId ?? ""), cwd: String(p.cwd ?? "") };
  if (row.source !== void 0) ev.source = row.source;
  if (row.event === "UserPromptSubmit" && typeof p.message === "string") ev.prompt = p.message;
  if (row.event === "PreToolUse" || row.event === "PostToolUse") {
    const name = String(p.toolName ?? "");
    ev.tool = { name, canonicalName: name, input: record(p.input) };
    if (typeof p.toolCallId === "string") ev.tool.callId = p.toolCallId;
  }
  if (row.event === "PostToolUse") ev.result = readResult6(p);
  if (typeof p.turn === "number") ev.turn = p.turn;
  return ev;
}
function stdoutFor(ev, d) {
  switch (d?.kind) {
    case "hint":
      return { stdout: ev.event === "SessionStart" ? d.text : "", exitCode: 0 };
    case "deny":
      if (ev.event !== "PreToolUse") return { stdout: "", exitCode: 0 };
      return { stdout: d.rewritten === void 0 ? d.reason : d.rewritten + "\n" + d.reason, exitCode: 2 };
    case "replace":
      return { stdout: ev.event === "PostToolUse" ? d.output : "", exitCode: 0 };
  }
  return { stdout: "", exitCode: 0 };
}
function encode9(ev, d, _extra) {
  const out = stdoutFor(ev, d);
  if (d?.kind === "allow") return out;
  return { stdout: out.stdout, exitCode: out.exitCode, role: PI_ROLE, content: out.stdout, timestamp: Date.now() };
}
function checkPermission(out) {
  return out.exitCode === 2 ? { block: true, reason: out.stdout } : void 0;
}

// src/adapters/opencode.ts
var TOOL_NAME_PREFIX10 = "";
var OWN_WIRE_PREFIX = SERVER_KEY + "_";
var OPENCODE_EVENTS = {
  context: "SessionStart",
  prompt: "UserPromptSubmit",
  "execute.before": "PreToolUse",
  "execute.after": "PostToolUse",
  compaction: "PreCompact",
  "step-finish": "Usage"
};
var NATIVE_TO_CANONICAL2 = { webfetch: "WebFetch" };
function toCanonicalTool(name) {
  if (name.startsWith(OWN_WIRE_PREFIX)) return name.slice(OWN_WIRE_PREFIX.length);
  return Object.prototype.hasOwnProperty.call(NATIVE_TO_CANONICAL2, name) ? NATIVE_TO_CANONICAL2[name] : name;
}
function record2(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? v : {};
}
function readResult7(p) {
  const text = p.output === void 0 ? "" : typeof p.output === "string" ? p.output : JSON.stringify(p.output);
  const info = { isError: p.isError === true, bytes: Buffer.byteLength(text), text };
  if (typeof p.exitCode === "number") info.exitCode = p.exitCode;
  return info;
}
function decode10(raw) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) throw new Error("opencode: hook payload is not an object");
  const p = raw;
  const native = typeof p.type === "string" ? p.type : "";
  const event = Object.prototype.hasOwnProperty.call(OPENCODE_EVENTS, native) ? OPENCODE_EVENTS[native] : void 0;
  if (event === void 0) throw new Error("opencode: unknown hook event " + String(p.type));
  const ev = { event, agent: "opencode", sessionId: String(p.sessionID ?? ""), cwd: String(p.directory ?? "") };
  if (event === "UserPromptSubmit" && typeof p.message === "string") ev.prompt = p.message;
  if (event === "PreToolUse" || event === "PostToolUse") {
    const name = String(p.tool ?? "");
    ev.tool = { name, canonicalName: toCanonicalTool(name), input: record2(p.args) };
    if (typeof p.callID === "string") ev.tool.callId = p.callID;
  }
  if (event === "PostToolUse") ev.result = readResult7(p);
  if (typeof p.turn === "number") ev.turn = p.turn;
  return ev;
}
function encode10(ev, d, _extra) {
  switch (d.kind) {
    case "allow":
      return { stdout: "", exitCode: 0 };
    case "hint":
      return { stdout: ev.event === "SessionStart" ? d.text : "", exitCode: 0 };
    case "deny":
      if (ev.event !== "PreToolUse") return { stdout: "", exitCode: 0 };
      return { stdout: d.rewritten === void 0 ? d.reason : d.rewritten + "\n" + d.reason, exitCode: 2 };
    case "replace":
      return { stdout: "", exitCode: 0 };
  }
}

// src/adapters/table.ts
var CLAUDE_EVENTS = { SessionStart: "SessionStart", UserPromptSubmit: "UserPromptSubmit", PreToolUse: "PreToolUse", PostToolUse: "PostToolUse" };
var CLAUDE_TOOLS = { shell: ["Bash"], read: ["Read"], grep: ["Grep"], webfetch: ["WebFetch"], edit: ["Write", "Edit", "NotebookEdit"] };
var ADAPTERS = Object.freeze([
  {
    id: "claude-code",
    installMode: "marketplace",
    projectSource: "env:CLAUDE_PROJECT_DIR",
    toolNamePrefix: TOOL_NAME_PREFIX,
    nativeTools: CLAUDE_TOOLS,
    execReadOnlyHint: false,
    eventMap: CLAUDE_EVENTS,
    compactDelivery: "sessionstart",
    compactSummary: "none",
    hookTimeoutMs: HOOK_TIMEOUT_MS,
    denyChannel: "deny-reason",
    decode,
    encode
  },
  {
    id: "codex",
    installMode: "config-mcp",
    projectSource: "arg:--agent+cwd",
    toolNamePrefix: TOOL_NAME_PREFIX2,
    nativeTools: { shell: ["Bash"], edit: ["apply_patch"] },
    execReadOnlyHint: true,
    eventMap: CLAUDE_EVENTS,
    compactDelivery: "sessionstart",
    compactSummary: "none",
    hookTimeoutMs: HOOK_TIMEOUT_MS,
    denyChannel: "deny-reason",
    decode: decode2,
    encode: encode2
  },
  {
    id: "gemini",
    installMode: "extension",
    projectSource: "spawn-cwd",
    toolNamePrefix: TOOL_NAME_PREFIX3,
    nativeTools: { shell: [] },
    execReadOnlyHint: false,
    eventMap: { SessionStart: "SessionStart", UserPromptSubmit: "BeforeAgent", PreToolUse: "BeforeTool", PostToolUse: "AfterTool", PreCompact: "PreCompress" },
    compactDelivery: "pending-flag",
    compactSummary: "none",
    hookTimeoutMs: HOOK_TIMEOUT_MS,
    denyChannel: "deny-reason",
    decode: decode3,
    encode: encode3
  },
  {
    id: "qwen",
    installMode: "extension",
    projectSource: "spawn-cwd",
    toolNamePrefix: TOOL_NAME_PREFIX4,
    nativeTools: { shell: ["run_shell_command", "Shell"], read: ["read_file"], grep: ["grep_search"], webfetch: ["web_fetch"] },
    execReadOnlyHint: false,
    eventMap: CLAUDE_EVENTS,
    compactDelivery: "sessionstart",
    compactSummary: "none",
    hookTimeoutMs: HOOK_TIMEOUT_MS,
    denyChannel: "deny-reason",
    decode: decode4,
    encode: encode4
  },
  {
    id: "copilot-cli",
    installMode: "plugin",
    projectSource: "arg:--agent+cwd",
    toolNamePrefix: TOOL_NAME_PREFIX5,
    nativeTools: { shell: [] },
    execReadOnlyHint: false,
    eventMap: { SessionStart: "sessionStart", UserPromptSubmit: "userPromptSubmitted", PreToolUse: "preToolUse", PostToolUse: "postToolUse" },
    compactDelivery: "pending-flag",
    compactSummary: "none",
    hookTimeoutMs: HOOK_TIMEOUT_MS,
    denyChannel: "deny-reason",
    decode: decode5,
    encode: encode5
  },
  {
    id: "vscode",
    installMode: "mcp-entry",
    projectSource: "arg:workspaceFolder",
    toolNamePrefix: TOOL_NAME_PREFIX6,
    // PreCompact sets the pending flag (ADR-0009 §6, DEVIATIONS D-M3-A4-1).
    nativeTools: { shell: [] },
    execReadOnlyHint: false,
    eventMap: { ...CLAUDE_EVENTS, PreCompact: "PreCompact" },
    compactDelivery: "pending-flag",
    compactSummary: "none",
    hookTimeoutMs: HOOK_TIMEOUT_MS,
    denyChannel: "deny-reason",
    decode: decode6,
    encode: encode6
  },
  {
    id: "kiro",
    installMode: "mcp-entry",
    projectSource: "arg:--agent+cwd",
    toolNamePrefix: TOOL_NAME_PREFIX7,
    nativeTools: { shell: [] },
    execReadOnlyHint: false,
    eventMap: { SessionStart: "SessionStart", UserPromptSubmit: "UserPromptSubmit", PreToolUse: "PreToolUse", PostToolUse: "PostToolUse" },
    compactDelivery: "none",
    compactSummary: "none",
    hookTimeoutMs: HOOK_TIMEOUT_MS,
    denyChannel: "hint-only",
    decode: decode7,
    encode: encode7
  },
  {
    // toolNamePrefix and nativeTools unverified until T-ZC (DECISIONS-r9 R3, R4: Claude names).
    id: "zcode",
    installMode: "hooks+mcp",
    projectSource: "spawn-cwd",
    toolNamePrefix: TOOL_NAME_PREFIX8,
    nativeTools: CLAUDE_TOOLS,
    execReadOnlyHint: false,
    eventMap: CLAUDE_EVENTS,
    compactDelivery: "sessionstart",
    compactSummary: "none",
    hookTimeoutMs: HOOK_TIMEOUT_MS,
    denyChannel: "deny-reason",
    decode: decode8,
    encode: encode8
  },
  {
    id: "pi",
    installMode: "in-process",
    projectSource: "pi:ctx.cwd",
    toolNamePrefix: TOOL_NAME_PREFIX9,
    nativeTools: { shell: [] },
    execReadOnlyHint: false,
    eventMap: { SessionStart: "session_start", UserPromptSubmit: "input", PreToolUse: "tool_call", PostToolUse: "tool_result" },
    compactDelivery: "pi-flag",
    compactSummary: "none",
    hookTimeoutMs: IN_PROCESS_TIMEOUT_MS,
    denyChannel: "deny-reason",
    decode: decode9,
    encode: encode9,
    checkPermission
  },
  {
    id: "opencode",
    installMode: "in-process",
    projectSource: "spawn-cwd",
    toolNamePrefix: TOOL_NAME_PREFIX10,
    nativeTools: { shell: [] },
    execReadOnlyHint: false,
    // Usage: step-finish cost row (DEVIATIONS D-M5-arch-2).
    eventMap: { SessionStart: "context", UserPromptSubmit: "prompt", PreToolUse: "execute.before", PostToolUse: "execute.after", PreCompact: "compaction", Usage: "step-finish" },
    compactDelivery: "opencode-cache",
    compactSummary: "none",
    hookTimeoutMs: IN_PROCESS_TIMEOUT_MS,
    denyChannel: "deny-reason",
    decode: decode10,
    encode: encode10,
    toCanonicalTool
  }
]);
var BY_ID = new Map(ADAPTERS.map((r) => [r.id, r]));
var REPLACE_ROWS = /* @__PURE__ */ new Set(["claude-code", "pi"]);
function hasReplace(row) {
  return REPLACE_ROWS.has(row.id);
}
var RECALL_ROWS = /* @__PURE__ */ new Set(["claude-code", "codex", "gemini", "qwen", "copilot-cli", "vscode", "zcode"]);
function hasRecall(row) {
  return RECALL_ROWS.has(row.id);
}
function getAdapter(id) {
  return BY_ID.get(id);
}

// src/core/policy/decide.ts
import { statSync } from "node:fs";
import { resolve } from "node:path";

// src/core/policy/lexer.ts
var OPS = ["&&", "||", ";;", "|&", ";", "|", "&", "(", ")"];
var IO_BOTH = ["&>>", "&>"];
var IO_AFTER_FD = [">>", ">|", ">&", ">", "<<<", "<<-", "<<", "<&", "<>", "<"];
var DUP_SUFFIX = "&";
var HEREDOC = "<<";
var HEREDOC_STRIP = "<<-";
var NEWLINE_OP = ";";
var CRLF = "\r\n";
var LINE_CONT = "\\\n";
var LINE_CONT_CRLF = "\\\r\n";
var DOLLAR_PAREN = "$(";
var DOLLAR_BRACE = "${";
var ANSI_QUOTE = "$'";
var ARITH_OPEN = "((";
var ARITH_CLOSE = "))";
var COND_OPEN = "[[";
var COND_CLOSE = "]]";
var PROC_IN = "<(";
var PROC_OUT = ">(";
var ESCAPED = "\\x".length;
var BOUNDARY = " 	\n\r;&|()<>";
var BLANK = " 	\n\r";
var DQ_ESCAPABLE = '$`"\\\n';
var CASE_WORD = "case";
var ESAC_WORD = "esac";
function fail(st, end) {
  if (st.end === "complete") st.end = end;
}
function isDigit(c) {
  return c !== "" && c >= "0" && c <= "9";
}
function isAlpha(c) {
  return c !== "" && (c >= "a" && c <= "z" || c >= "A" && c <= "Z");
}
function isBoundary(c) {
  return c === "" || BOUNDARY.includes(c);
}
function isBlank(c) {
  return c !== "" && BLANK.includes(c);
}
function push(out, kind, text, start, end) {
  if (out !== null) out.push({ kind, text, start, end });
}
function skipSingle(st, i) {
  const j = st.s.indexOf("'", i + 1);
  if (j < 0) {
    fail(st, "unterminated-quote");
    return st.n;
  }
  return j + 1;
}
function skipAnsi(st, i) {
  let j = i + ANSI_QUOTE.length;
  while (j < st.n) {
    const c = st.s.charAt(j);
    if (c === "\\") {
      j += ESCAPED;
      continue;
    }
    if (c === "'") return j + 1;
    j++;
  }
  fail(st, "unterminated-quote");
  return st.n;
}
function skipDouble(st, i, depth) {
  let j = i + 1;
  while (j < st.n) {
    const c = st.s.charAt(j);
    const next = st.s.charAt(j + 1);
    if (c === "\\") {
      j += ESCAPED;
      continue;
    }
    if (c === '"') return j + 1;
    if (c === "$" && next === "(") {
      j = skipDollarParen(st, j, depth);
      continue;
    }
    if (c === "$" && next === "{") {
      j = skipBrace(st, j, depth);
      continue;
    }
    if (c === "`") {
      j = skipBacktick(st, j);
      continue;
    }
    j++;
  }
  fail(st, "unterminated-quote");
  return st.n;
}
function skipBacktick(st, i) {
  let j = i + 1;
  while (j < st.n) {
    const c = st.s.charAt(j);
    if (c === "\\") {
      j += ESCAPED;
      continue;
    }
    if (c === "`") return j + 1;
    j++;
  }
  return st.n;
}
function skipBrace(st, i, depth) {
  let j = i + DOLLAR_BRACE.length;
  let open = 0;
  while (j < st.n) {
    const c = st.s.charAt(j);
    const next = st.s.charAt(j + 1);
    if (c === "\\") {
      j += ESCAPED;
      continue;
    }
    if (c === "'") {
      j = skipSingle(st, j);
      continue;
    }
    if (c === '"') {
      j = skipDouble(st, j, depth);
      continue;
    }
    if (c === "$" && next === "(") {
      j = skipDollarParen(st, j, depth);
      continue;
    }
    if (c === "`") {
      j = skipBacktick(st, j);
      continue;
    }
    if (c === "{") open++;
    if (c === "}") {
      if (open === 0) return j + 1;
      open--;
    }
    j++;
  }
  return st.n;
}
function arithEnd(s, i) {
  let open = 0;
  let j = i + ARITH_OPEN.length;
  while (j < s.length) {
    const c = s.charAt(j);
    if (c === "(") open++;
    if (c === ")") {
      if (open === 0) return s.startsWith(ARITH_CLOSE, j) ? j + ARITH_CLOSE.length : -1;
      open--;
    }
    j++;
  }
  return -1;
}
function skipDollarParen(st, i, depth) {
  const open = i + DOLLAR_PAREN.length - 1;
  if (st.s.startsWith(ARITH_OPEN, open)) {
    const e = arithEnd(st.s, open);
    if (e > 0) return e;
  }
  return lexSpan(st, open + 1, true, depth + 1, null, null);
}
function condEnd(st, i, depth) {
  let j = i + COND_OPEN.length;
  let open = 0;
  while (j < st.n) {
    const c = st.s.charAt(j);
    const next = st.s.charAt(j + 1);
    if (c === "\\") {
      j += ESCAPED;
      continue;
    }
    if (c === "'") {
      j = skipSingle(st, j);
      continue;
    }
    if (c === '"') {
      j = skipDouble(st, j, depth);
      continue;
    }
    if (c === "$" && next === "(") {
      j = skipDollarParen(st, j, depth);
      continue;
    }
    if (c === "$" && next === "{") {
      j = skipBrace(st, j, depth);
      continue;
    }
    if (c === "`") {
      j = skipBacktick(st, j);
      continue;
    }
    const blankBefore = isBlank(st.s.charAt(j - 1));
    if (blankBefore && st.s.startsWith(COND_CLOSE, j) && isBoundary(st.s.charAt(j + COND_CLOSE.length))) {
      if (open === 0) return j + COND_CLOSE.length;
      open--;
      j += COND_CLOSE.length;
      continue;
    }
    if (blankBefore && st.s.startsWith(COND_OPEN, j) && isBlank(st.s.charAt(j + COND_OPEN.length))) {
      open++;
      j += COND_OPEN.length;
      continue;
    }
    j++;
  }
  return -1;
}
function ioAt(s, i) {
  let j = i;
  while (isDigit(s.charAt(j))) j++;
  if (j === i) {
    for (const op of IO_BOTH) if (s.startsWith(op, i)) return { end: i + op.length, op };
  }
  for (const op of IO_AFTER_FD) {
    if (!s.startsWith(op, j)) continue;
    let e = j + op.length;
    if (op.endsWith(DUP_SUFFIX)) {
      if (s.charAt(e) === "-") e++;
      else while (isDigit(s.charAt(e))) e++;
    }
    return { end: e, op };
  }
  return null;
}
function readWord(st, i, depth) {
  let j = i;
  while (j < st.n) {
    const c = st.s.charAt(j);
    const next = st.s.charAt(j + 1);
    if (BOUNDARY.includes(c)) break;
    if (c === "\\") {
      j += ESCAPED;
      continue;
    }
    if (c === "'") {
      j = skipSingle(st, j);
      continue;
    }
    if (c === '"') {
      j = skipDouble(st, j, depth);
      continue;
    }
    if (c === "$" && next === "'") {
      j = skipAnsi(st, j);
      continue;
    }
    if (c === "$" && next === "(") {
      j = skipDollarParen(st, j, depth);
      continue;
    }
    if (c === "$" && next === "{") {
      j = skipBrace(st, j, depth);
      continue;
    }
    if (c === "`") {
      j = skipBacktick(st, j);
      continue;
    }
    j++;
  }
  return Math.min(j, st.n);
}
function readBodies(st, i, pending, out, bodies) {
  let at2 = i;
  for (const h of pending) {
    const start = at2;
    let found = false;
    while (at2 < st.n) {
      const nl = st.s.indexOf("\n", at2);
      const lineEnd = nl < 0 ? st.n : nl;
      let line = st.s.slice(at2, lineEnd);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      at2 = nl < 0 ? st.n : nl + 1;
      if ((h.strip ? line.trim() : line) === h.tag) {
        found = true;
        break;
      }
    }
    if (out !== null && bodies !== null) bodies.push(out.length);
    push(out, "unhandled", st.s.slice(start, at2), start, at2);
    if (!found) {
      fail(st, "unterminated-heredoc");
      return st.n;
    }
  }
  pending.length = 0;
  return at2;
}
function lexSpan(st, from, inParen, depth, out, bodies) {
  if (depth > MAX_NEST_DEPTH) {
    fail(st, "too-deep");
    return st.n;
  }
  const s = st.s;
  let i = from;
  let parens = 0;
  let cases = 0;
  let tagStrip = null;
  const pending = [];
  while (i < st.n) {
    const c = s.charAt(i);
    const next = s.charAt(i + 1);
    if (c === " " || c === "	") {
      i++;
      continue;
    }
    if (s.startsWith(LINE_CONT, i)) {
      i += LINE_CONT.length;
      continue;
    }
    if (s.startsWith(LINE_CONT_CRLF, i)) {
      i += LINE_CONT_CRLF.length;
      continue;
    }
    if (c === "\n" || c === "\r") {
      const start2 = i;
      i += s.startsWith(CRLF, i) ? CRLF.length : 1;
      push(out, "op", NEWLINE_OP, start2, i);
      tagStrip = null;
      if (pending.length > 0) i = readBodies(st, i, pending, out, bodies);
      continue;
    }
    if (c === "#") {
      while (i < st.n && s.charAt(i) !== "\n" && s.charAt(i) !== "\r") i++;
      continue;
    }
    if (s.startsWith(PROC_IN, i) || s.startsWith(PROC_OUT, i)) {
      const e = lexSpan(st, i + PROC_IN.length, true, depth + 1, null, null);
      push(out, "unhandled", s.slice(i, e), i, e);
      i = e;
      tagStrip = null;
      continue;
    }
    const io = ioAt(s, i);
    if (io !== null) {
      push(out, "io", s.slice(i, io.end), i, io.end);
      tagStrip = io.op === HEREDOC || io.op === HEREDOC_STRIP ? io.op === HEREDOC_STRIP : null;
      i = io.end;
      continue;
    }
    if (s.startsWith(COND_OPEN, i) && isBlank(s.charAt(i + COND_OPEN.length))) {
      const e = condEnd(st, i, depth);
      if (e > 0) {
        push(out, "unhandled", s.slice(i, e), i, e);
        i = e;
        tagStrip = null;
        continue;
      }
    }
    if (s.startsWith(ARITH_OPEN, i)) {
      const e = arithEnd(s, i);
      if (e > 0) {
        push(out, "unhandled", s.slice(i, e), i, e);
        i = e;
        tagStrip = null;
        continue;
      }
    }
    const op = OPS.find((o) => s.startsWith(o, i));
    if (op !== void 0) {
      if (inParen && op === "(") parens++;
      if (inParen && op === ")") {
        if (parens > 0) parens--;
        else if (cases === 0) return i + 1;
      }
      push(out, "op", op, i, i + op.length);
      i += op.length;
      tagStrip = null;
      continue;
    }
    if (c === "$" && next === "(" || c === "`") {
      const e = c === "`" ? skipBacktick(st, i) : skipDollarParen(st, i, depth);
      if (isBoundary(s.charAt(e))) {
        push(out, "unhandled", s.slice(i, e), i, e);
        i = e;
        tagStrip = null;
        continue;
      }
    }
    const start = i;
    i = readWord(st, i, depth);
    const text = s.slice(start, i);
    push(out, "word", text, start, i);
    if (tagStrip !== null) {
      pending.push({ tag: dequote(text), strip: tagStrip });
      tagStrip = null;
    }
    if (inParen && text === CASE_WORD) cases++;
    if (inParen && text === ESAC_WORD && cases > 0) cases--;
  }
  if (pending.length > 0) fail(st, "unterminated-heredoc");
  return st.n;
}
function scan(cmd) {
  const st = { s: cmd, n: cmd.length, end: "complete" };
  const tokens = [];
  const heredocBodies = [];
  lexSpan(st, 0, false, 0, tokens, heredocBodies);
  return { tokens, heredocBodies, end: st.end };
}
function dequote(word) {
  let out = "";
  let i = 0;
  const n = word.length;
  while (i < n) {
    const c = word.charAt(i);
    if (c === "\\") {
      out += word.charAt(i + 1);
      i += ESCAPED;
      continue;
    }
    if (c === "'") {
      const j = word.indexOf("'", i + 1);
      const e = j < 0 ? n : j;
      out += word.slice(i + 1, e);
      i = e + 1;
      continue;
    }
    if (c === "$" && word.charAt(i + 1) === "'") {
      let j = i + ANSI_QUOTE.length;
      while (j < n && word.charAt(j) !== "'") {
        if (word.charAt(j) === "\\") {
          out += word.charAt(j + 1);
          j += ESCAPED;
          continue;
        }
        out += word.charAt(j);
        j++;
      }
      i = j + 1;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      while (j < n && word.charAt(j) !== '"') {
        const e = word.charAt(j + 1);
        if (word.charAt(j) === "\\" && e !== "" && DQ_ESCAPABLE.includes(e)) {
          out += e;
          j += ESCAPED;
          continue;
        }
        out += word.charAt(j);
        j++;
      }
      i = j + 1;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}
function substitutions(text) {
  const st = { s: text, n: text.length, end: "complete" };
  const found = [];
  let inDouble = false;
  let i = 0;
  while (i < st.n) {
    const c = text.charAt(i);
    const next = text.charAt(i + 1);
    if (c === "\\") {
      i += ESCAPED;
      continue;
    }
    if (!inDouble && c === "'") {
      i = skipSingle(st, i);
      continue;
    }
    if (!inDouble && c === "$" && next === "'") {
      i = skipAnsi(st, i);
      continue;
    }
    if (c === '"') {
      inDouble = !inDouble;
      i++;
      continue;
    }
    if (c === "$" && next === "{") {
      i += DOLLAR_BRACE.length;
      continue;
    }
    const procIn = text.startsWith(PROC_IN, i);
    if (c === "$" && next === "(" || !inDouble && (procIn || text.startsWith(PROC_OUT, i))) {
      const open = i + 1;
      if (c === "$" && text.startsWith(ARITH_OPEN, open)) {
        if (arithEnd(text, open) > 0) {
          i = open + ARITH_OPEN.length;
          continue;
        }
      }
      const e = lexSpan(st, open + 1, true, 1, null, null);
      const bodyEnd = e > open + 1 && text.charAt(e - 1) === ")" ? e - 1 : e;
      found.push({ wrapper: c === "$" ? "$()" : procIn ? "<()" : ">()", body: text.slice(open + 1, bodyEnd) });
      i = e;
      continue;
    }
    if (c === "`") {
      const e = skipBacktick(st, i);
      const bodyEnd = e > i + 1 && text.charAt(e - 1) === "`" ? e - 1 : e;
      found.push({ wrapper: "`", body: text.slice(i + 1, bodyEnd) });
      i = e;
      continue;
    }
    i++;
  }
  return found;
}
function isAssignment(word) {
  const first = word.charAt(0);
  if (!(isAlpha(first) || first === "_")) return false;
  for (let i = 1; i < word.length; i++) {
    const c = word.charAt(i);
    if (c === "=") return true;
    if (c === "+" && word.charAt(i + 1) === "=") return true;
    if (!(isAlpha(c) || isDigit(c) || c === "_")) return false;
  }
  return false;
}

// src/core/policy/parse.ts
var SEPARATORS = [";", "&", "&&", "||"];
var PIPES = ["|", "|&"];
var SUBSHELL_OPEN = "(";
var SUBSHELL_CLOSE = ")";
var CASE_BREAK = ";;";
var FUNC_PARENS = ["(", ")"];
var NOT = "!";
var KW = Object.freeze({
  group: "{",
  groupEnd: "}",
  if: "if",
  then: "then",
  elif: "elif",
  else: "else",
  fi: "fi",
  while: "while",
  until: "until",
  for: "for",
  in: "in",
  do: "do",
  done: "done",
  case: "case",
  esac: "esac",
  function: "function",
  coproc: "coproc",
  select: "select"
});
var NO_STOP = [];
var COND_PREFIX = "[[";
var ARITH_PREFIX = "((";
var TO_FILE_OPS = [">", ">>", ">|", "&>", "&>>", ">&"];
var TARGET_OPS = [...TO_FILE_OPS, "<", "<>", "<<<", "<<", "<<-"];
var STDOUT_FDS = ["", "1"];
var STDOUT_ALIASES = ["-", "/dev/stdout", "/dev/stderr"];
var OPT = "-";
var LONG_OPT = "--";
var OPT_VALUE = "=";
var PATH_SEP = "/";
var OUTPUT_FLAGS = Object.freeze({
  curl: { short: "o", long: "--output" },
  wget: { short: "O", long: "--output-document" }
});
var SINK = Object.freeze({ head: "head", wc: "wc", grep: "grep", jq: "jq" });
var HEAD_BYTES = "-c";
var HEAD_BYTES_LONG = "--bytes";
var GREP_COUNT_SHORT = "c";
var GREP_COUNT_LONG = "--count";
var EMPTY3 = () => ({ cmds: [], simple: null });
var at = (p, k = 0) => p.toks[p.i + k];
var isOp = (t, text) => t !== void 0 && t.kind === "op" && t.text === text;
var isWord = (t, text) => t !== void 0 && t.kind === "word" && t.text === text;
var isDigit2 = (c) => c !== "" && c >= "0" && c <= "9";
var isWordChar = (c) => isDigit2(c) || c >= "a" && c <= "z" || c >= "A" && c <= "Z" || c === "_";
function baseName(word) {
  const k = word.lastIndexOf(PATH_SEP);
  return k >= 0 && k < word.length - 1 ? word.slice(k + 1) : word;
}
function writesFile(argv0, args) {
  const flag = OUTPUT_FLAGS[argv0.toLowerCase()];
  if (flag === void 0) return false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === LONG_OPT) break;
    let value;
    if (a === flag.long) value = args[k + 1];
    else if (a.startsWith(flag.long + OPT_VALUE)) value = a.slice(flag.long.length + OPT_VALUE.length);
    else if (a.startsWith(OPT) && !a.startsWith(LONG_OPT)) {
      const pos = a.indexOf(flag.short, OPT.length);
      if (pos < 0) continue;
      value = pos + flag.short.length < a.length ? a.slice(pos + flag.short.length) : args[k + 1];
    } else continue;
    if (value !== void 0 && !STDOUT_ALIASES.includes(value)) return true;
  }
  return false;
}
function allDigits(s) {
  if (s === "") return false;
  for (const c of s) if (!isDigit2(c)) return false;
  return true;
}
function headBounded(args) {
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    let n;
    if (a === HEAD_BYTES || a === HEAD_BYTES_LONG) n = args[k + 1];
    else if (a.startsWith(HEAD_BYTES_LONG + OPT_VALUE)) n = a.slice(HEAD_BYTES_LONG.length + OPT_VALUE.length);
    else if (a.startsWith(HEAD_BYTES) && !a.startsWith(LONG_OPT)) n = a.slice(HEAD_BYTES.length);
    if (n !== void 0) return allDigits(n) && Number(n) <= OUTPUT_CAP;
  }
  return false;
}
function grepCounts(args) {
  for (const a of args) {
    if (a === LONG_OPT) return false;
    if (a === GREP_COUNT_LONG) return true;
    if (a.startsWith(OPT) && !a.startsWith(LONG_OPT) && a.includes(GREP_COUNT_SHORT)) return true;
  }
  return false;
}
function jqPath(s) {
  if (!s.startsWith(JQ_WHITELIST.fieldSep)) return false;
  for (const seg of s.slice(JQ_WHITELIST.fieldSep.length).split(JQ_WHITELIST.fieldSep)) {
    if (seg === "") return false;
    for (const c of seg) if (!isWordChar(c)) return false;
  }
  return true;
}
function jqWhitelisted(filter) {
  const s = filter.trim();
  if (s === JQ_WHITELIST.identity || s === JQ_WHITELIST.length) return true;
  const bar = s.indexOf(JQ_WHITELIST.pipeLength.charAt(0));
  if (bar < 0) return jqPath(s);
  const left = s.slice(0, bar).trim();
  const right = JQ_WHITELIST.pipeLength.slice(1).trim();
  return (left === JQ_WHITELIST.identity || jqPath(left)) && s.slice(bar + 1).trim() === right;
}
function isBoundedSink(c) {
  const name = c.argv0.toLowerCase();
  if (name === SINK.wc) return true;
  if (name === SINK.head) return headBounded(c.args);
  if (name === SINK.grep) return grepCounts(c.args);
  if (name === SINK.jq) {
    const positional = c.args.filter((a) => !a.startsWith(OPT));
    return positional.length === 1 && jqWhitelisted(positional[0]);
  }
  return false;
}
function carrier(raw) {
  if (substitutions(raw).length === 0) return [];
  return [{ argv0: "", args: [], redirectsToFile: false, endsInBoundedSink: false, raw }];
}
function carrierOf(p, from, to) {
  if (to <= from) return [];
  return carrier(p.src.slice(p.toks[from].start, p.toks[to - 1].end));
}
function tag(cmds, name) {
  for (const c of cmds) if (c.insideConstruct === void 0) c.insideConstruct = name;
}
function splitIo(text) {
  let k = 0;
  while (isDigit2(text.charAt(k))) k++;
  return { fd: text.slice(0, k), op: text.slice(k) };
}
function ioRedirect(p) {
  const io = splitIo(p.toks[p.i].text);
  p.i++;
  if (!TARGET_OPS.includes(io.op)) return false;
  const target = at(p);
  if (target === void 0 || target.kind === "op" || target.kind === "io") return false;
  p.i++;
  return TO_FILE_OPS.includes(io.op) && STDOUT_FDS.includes(io.fd) && !STDOUT_ALIASES.includes(dequote(target.text));
}
function trailingRedirects(p) {
  let toFile = false;
  while (at(p)?.kind === "io") toFile = ioRedirect(p) || toFile;
  return toFile;
}
function skipSeparators(p) {
  while (at(p)?.kind === "op" && SEPARATORS.includes(at(p)?.text ?? "")) p.i++;
}
function compound(p, body) {
  p.depth++;
  if (p.depth > MAX_NEST_DEPTH) {
    p.err = "nesting-too-deep";
    return EMPTY3();
  }
  const cmds = body();
  p.depth--;
  if (trailingRedirects(p)) for (const c of cmds) c.redirectsToFile = true;
  return { cmds, simple: null };
}
function doBlock(p) {
  skipSeparators(p);
  if (!isWord(at(p), KW.do)) return [];
  p.i++;
  const body = list(p, [KW.done]);
  if (isWord(at(p), KW.done)) p.i++;
  return body;
}
function ifBody(p) {
  p.i++;
  const out = list(p, [KW.then]);
  while (p.err === null) {
    const t = at(p);
    if (isWord(t, KW.then) || isWord(t, KW.else)) {
      p.i++;
      out.push(...list(p, [KW.elif, KW.else, KW.fi]));
      continue;
    }
    if (isWord(t, KW.elif)) {
      p.i++;
      out.push(...list(p, [KW.then]));
      continue;
    }
    if (isWord(t, KW.fi)) p.i++;
    break;
  }
  return out;
}
function loopBody(p) {
  p.i++;
  const out = list(p, [KW.do]);
  out.push(...doBlock(p));
  return out;
}
function forBody(p) {
  p.i++;
  const out = [];
  const t = at(p);
  if (t?.kind === "unhandled") p.i++;
  else {
    if (t?.kind === "word") p.i++;
    if (isWord(at(p), KW.in)) {
      p.i++;
      const from = p.i;
      while ((at(p)?.kind === "word" || at(p)?.kind === "unhandled") && !isWord(at(p), KW.do)) p.i++;
      out.push(...carrierOf(p, from, p.i));
    }
  }
  out.push(...doBlock(p));
  return out;
}
function caseBody(p) {
  p.i++;
  const out = [];
  const subject = at(p);
  if (subject !== void 0 && subject.kind !== "op" && subject.kind !== "io") {
    p.i++;
    out.push(...carrierOf(p, p.i - 1, p.i));
  }
  if (isWord(at(p), KW.in)) p.i++;
  while (p.i < p.toks.length && p.err === null) {
    const t = p.toks[p.i];
    if (p.bodies.has(p.i) || t.kind === "op" && (SEPARATORS.includes(t.text) || t.text === CASE_BREAK)) {
      p.i++;
      continue;
    }
    if (isWord(t, KW.esac)) {
      p.i++;
      break;
    }
    if (isOp(t, SUBSHELL_OPEN)) p.i++;
    while (p.i < p.toks.length && !isOp(at(p), SUBSHELL_CLOSE)) {
      const pt = p.toks[p.i];
      if (pt.kind === "op" && !PIPES.includes(pt.text)) break;
      p.i++;
    }
    if (!isOp(at(p), SUBSHELL_CLOSE)) break;
    p.i++;
    const body = list(p, [KW.esac]);
    tag(body, KW.case);
    out.push(...body);
  }
  return out;
}
function functionBody(p, name) {
  skipSeparators(p);
  const el = element(p);
  tag(el.cmds, name);
  return { cmds: el.cmds, simple: null };
}
function hasFuncParens(p, from) {
  return FUNC_PARENS.every((text, k) => isOp(p.toks[from + k], text));
}
function simple(p) {
  const first = p.i;
  const words = [];
  let toFile = false;
  while (p.i < p.toks.length) {
    const t = p.toks[p.i];
    if (t.kind === "op") break;
    if (t.kind === "io") {
      toFile = ioRedirect(p) || toFile;
      continue;
    }
    if (words.length === 0 && t.kind === "word" && isAssignment(t.text)) {
      p.i++;
      const open = at(p);
      if (t.text.endsWith(OPT_VALUE) && open !== void 0 && isOp(open, SUBSHELL_OPEN) && open.start === t.end) {
        let parens = 0;
        while (p.i < p.toks.length) {
          const a = p.toks[p.i];
          p.i++;
          if (isOp(a, SUBSHELL_OPEN)) parens++;
          if (isOp(a, SUBSHELL_CLOSE) && --parens === 0) break;
        }
      }
      continue;
    }
    words.push(t);
    p.i++;
  }
  if (p.i === first) return EMPTY3();
  const raw = p.src.slice(p.toks[first].start, p.toks[p.i - 1].end);
  if (words.length === 0) return { cmds: carrier(raw), simple: null };
  const text = (t) => t.kind === "word" ? dequote(t.text) : t.text;
  const argv0 = baseName(text(words[0]));
  const args = words.slice(1).map(text);
  const cmd = { argv0, args, redirectsToFile: toFile || writesFile(argv0, args), endsInBoundedSink: false, raw };
  return { cmds: [cmd], simple: cmd };
}
function element(p) {
  const t = at(p);
  if (t === void 0) return EMPTY3();
  if (t.kind === "op") {
    if (t.text !== SUBSHELL_OPEN) return EMPTY3();
    return compound(p, () => {
      p.i++;
      const body = list(p, NO_STOP);
      if (isOp(at(p), SUBSHELL_CLOSE)) p.i++;
      return body;
    });
  }
  if (t.kind === "unhandled" && (t.text.startsWith(COND_PREFIX) || t.text.startsWith(ARITH_PREFIX))) {
    p.i++;
    trailingRedirects(p);
    return { cmds: carrier(t.text), simple: null };
  }
  if (t.kind === "word") {
    switch (t.text) {
      case KW.group:
        return compound(p, () => {
          p.i++;
          const body = list(p, [KW.groupEnd]);
          if (isWord(at(p), KW.groupEnd)) p.i++;
          return body;
        });
      case KW.if:
        return compound(p, () => ifBody(p));
      case KW.while:
      case KW.until:
        return compound(p, () => loopBody(p));
      case KW.for:
        return compound(p, () => forBody(p));
      case KW.case:
        return compound(p, () => caseBody(p));
      case KW.coproc:
        p.err = "coproc";
        return EMPTY3();
      case KW.select:
        p.err = "select";
        return EMPTY3();
      case KW.function: {
        p.i++;
        const nameTok = at(p);
        let name = "";
        if (nameTok?.kind === "word") {
          name = dequote(nameTok.text);
          p.i++;
        }
        if (hasFuncParens(p, p.i)) p.i += FUNC_PARENS.length;
        return functionBody(p, name);
      }
      default:
        if (hasFuncParens(p, p.i + 1)) {
          p.i += FUNC_PARENS.length + 1;
          return functionBody(p, dequote(t.text));
        }
    }
  }
  return simple(p);
}
function pipeline(p) {
  if (isWord(at(p), NOT)) p.i++;
  const all = [];
  let last = EMPTY3();
  while (p.err === null) {
    last = element(p);
    all.push(...last.cmds);
    const t = at(p);
    if (t !== void 0 && t.kind === "op" && PIPES.includes(t.text)) {
      p.i++;
      continue;
    }
    break;
  }
  if (last.simple !== null && isBoundedSink(last.simple)) for (const c of all) c.endsInBoundedSink = true;
  return all;
}
function list(p, stop) {
  const out = [];
  while (p.i < p.toks.length && p.err === null) {
    const t = p.toks[p.i];
    if (p.bodies.has(p.i)) {
      p.i++;
      continue;
    }
    if (t.kind === "op") {
      if (t.text === SUBSHELL_CLOSE || t.text === CASE_BREAK) return out;
      if (t.text !== SUBSHELL_OPEN) {
        p.i++;
        continue;
      }
    }
    if (t.kind === "word" && stop.includes(t.text)) return out;
    const before = p.i;
    out.push(...pipeline(p));
    if (p.i === before && p.err === null) p.i++;
  }
  return out;
}
function parseShell(cmd) {
  const s = scan(cmd);
  if (s.end === "unterminated-quote") return { ok: false, construct: "unterminated-quote" };
  if (s.end === "unterminated-heredoc") return { ok: false, construct: "unterminated-heredoc" };
  if (s.end === "too-deep") return { ok: false, construct: "nesting-too-deep" };
  const p = { toks: s.tokens, src: cmd, bodies: new Set(s.heredocBodies), i: 0, depth: 0, err: null };
  const commands = [];
  while (p.i < p.toks.length && p.err === null) {
    commands.push(...list(p, NO_STOP));
    if (p.i < p.toks.length) p.i++;
  }
  if (p.err !== null) return { ok: false, construct: p.err };
  return { ok: true, commands };
}

// src/core/policy/subagent.ts
import { readFileSync } from "node:fs";
import { join as join2 } from "node:path";

// src/core/project/config-dir.ts
import { mkdirSync, realpathSync } from "node:fs";
import { join } from "node:path";

// src/core/contracts/errors.ts
var ERROR_TEXT = Object.freeze({
  NODE_TOO_OLD: "Node <v> is below 24.15.0. Fix: install Node 24.15.0 or later.",
  NO_SQLITE: "node:sqlite failed to load. Fix: run ctx_doctor.",
  DB_GONE: "context.db path vanished. Fix: run ctx_doctor.",
  NO_PROJECT: "Project source <kind> is missing. Fix: run ctx_doctor.",
  UNKNOWN_FIELD: 'Unknown field "<f>". Fix: use "queries".',
  TIMEOUT: "Timed out after <ms> ms. Fix: pass background: true.",
  NO_RUNTIME: "No <lang> runtime on PATH. Fix: install it or pick another language.",
  FETCH_FAILED: "Fetch failed: <code>. Fix: check the URL or proxy.",
  SSRF: "Blocked private address <host>. Fix: use a public URL.",
  OUTSIDE_ROOT: "Path <p> is outside the project. Fix: use a path inside <root>.",
  INVALID_ARGS: "Invalid argument <field>. Fix: <action>.",
  ONE_OF_INPUT: "Pass exactly one of <names>. Fix: drop the extra field.",
  SPAWN_FAILED: "Failed to start the process: <detail>. Fix: check the command and PATH.",
  DB_CORRUPT: "context.db failed integrity_check. Fix: run ctx_doctor.",
  SCHEMA_STALE: "context.db schema is version <found>, expected <want>. Fix: run ctx_doctor.",
  NO_GIT_DIR: "No git repository at <path>. Fix: run context-mode inside a git repository.",
  NO_HOME: "Env var <name> is not set. Fix: set <name> to your home directory.",
  PLUGIN_ROOT_MISSING: "Plugin root for <agent> not found at <path>. Fix: run ctx_upgrade.",
  // impl/07 §1 Errors
  BUNDLE_HASH_MISMATCH: "Fetched bundle hash does not match SHA256SUMS. Fix: run ctx_upgrade again.",
  // impl/07 §6 Errors
  CONFIG_PARSE_FAILED: "<agent> config at <path> did not parse as <format>. Fix: fix the syntax error and re-run ctx_upgrade."
  // impl/07 §2 Errors
});
function formatError(code, vars) {
  const template = ERROR_TEXT[code];
  let out = "";
  let i = 0;
  while (i < template.length) {
    if (template[i] !== "<") {
      out += template[i];
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < template.length && template[j] !== "<" && template[j] !== ">") j += 1;
    if (j >= template.length) {
      out += template.slice(i);
      break;
    }
    if (template[j] === "<") {
      out += "<";
      i += 1;
      continue;
    }
    const name = template.slice(i + 1, j);
    const value = vars[name];
    if (value === void 0) throw new Error("formatError: missing var " + name + " for " + code);
    out += String(value);
    i = j + 1;
  }
  return out;
}
var CtxError = class extends Error {
  code;
  vars;
  constructor(code, vars) {
    super(formatError(code, vars ?? {}));
    this.code = code;
    this.vars = vars ?? {};
  }
  toLine() {
    return this.message;
  }
};

// src/core/project/config-dir.ts
function homeDirOf(env) {
  const home = env.HOME;
  if (home !== void 0 && home !== "") return home;
  const profile = env.USERPROFILE;
  if (profile !== void 0 && profile !== "") return profile;
  return null;
}
function homeOf(env) {
  const home = homeDirOf(env);
  if (home !== null) return home;
  throw new CtxError("NO_HOME", { name: process.platform === "win32" ? "USERPROFILE" : "HOME" });
}
function resolveConfigDir(env) {
  const dir = join(homeOf(env), DATA_ROOT.slice(1));
  mkdirSync(dir, { recursive: true });
  return realpathSync.native(dir);
}

// src/core/policy/subagent.ts
function isSubagentCall(ev) {
  return ev.agentId !== void 0 && ev.agentId !== "";
}
function pickSubagentCase(ev, toolSet) {
  if (toolSet === null) return "C";
  const row = getAdapter(ev.agent);
  const have = new Set(toolSet);
  for (const t of TOOL_ORDER) if (have.has(row.toolNamePrefix + t)) return "A";
  for (const s of row.nativeTools.shell) if (have.has(s)) return "B";
  return "C";
}
function toolSetForAgentType(ev, src) {
  if (!isSubagentCall(ev)) return null;
  const row = getAdapter(ev.agent);
  if (src.manifestTools !== void 0) return unique(src.manifestTools.map((n) => norm(row, n)));
  const type = ev.agentType ?? "";
  const def = findDef(type, src);
  if (def === null) return null;
  const tools = (def.tools ?? allKnownToolNames(row)).map((n) => norm(row, n));
  const deny2 = def.disallowed.map((n) => norm(row, n));
  return unique(tools.filter((n) => !deny2.some((d) => denies(d, n))));
}
function findDef(type, src) {
  if (!safeType(type)) return null;
  const home = homeDir(src.env);
  const plugin = type.indexOf(PLUGIN_AGENT_SEPARATOR) >= 0;
  if (!plugin) {
    const p = readAgentFile(join2(src.projectDir, HOST_CONFIG_DIR_NAME, AGENTS_DIR_NAME, type + AGENT_FILE_EXT));
    if (p !== null) return p;
    if (home !== null) {
      const u = readAgentFile(join2(home, HOST_CONFIG_DIR_NAME, AGENTS_DIR_NAME, type + AGENT_FILE_EXT));
      if (u !== null) return u;
    }
  } else if (home !== null) {
    const pl = readPluginAgent(home, type);
    if (pl !== null) return pl;
  }
  const cli = src.cliAgents;
  if (cli !== void 0 && Object.prototype.hasOwnProperty.call(cli, type)) {
    const d = cli[type];
    return { tools: Array.isArray(d.tools) ? d.tools : null, disallowed: Array.isArray(d.disallowedTools) ? d.disallowedTools : [] };
  }
  return null;
}
function safeType(type) {
  if (type === "" || type === "." || type === "..") return false;
  if (type.indexOf("/") >= 0 || type.indexOf("\\") >= 0) return false;
  for (const part of type.split(PLUGIN_AGENT_SEPARATOR)) if (part === "" || part === "." || part === "..") return false;
  return true;
}
function homeDir(env) {
  return homeDirOf(env);
}
function readPluginAgent(home, type) {
  const cut = type.indexOf(PLUGIN_AGENT_SEPARATOR);
  const plugin = type.slice(0, cut);
  const agent = type.slice(cut + PLUGIN_AGENT_SEPARATOR.length);
  if (agent.indexOf(PLUGIN_AGENT_SEPARATOR) >= 0) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join2(home, HOST_CONFIG_DIR_NAME, HOST_PLUGINS_DIR_NAME, INSTALLED_PLUGINS_FILE), "utf8"));
  } catch {
    return null;
  }
  const plugins = parsed?.plugins;
  if (plugins === null || typeof plugins !== "object") return null;
  for (const key of Object.keys(plugins)) {
    const at2 = key.indexOf(PLUGIN_KEY_SEPARATOR);
    if ((at2 < 0 ? key : key.slice(0, at2)) !== plugin) continue;
    const entries = plugins[key];
    if (!Array.isArray(entries)) continue;
    for (const e of entries) {
      const dir = e?.installPath;
      if (typeof dir !== "string" || dir === "") continue;
      const d = readAgentFile(join2(dir, AGENTS_DIR_NAME, agent + AGENT_FILE_EXT));
      if (d !== null) return d;
    }
  }
  return null;
}
function readAgentFile(path) {
  let text;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return null;
  }
  return parseFrontmatter(text);
}
function parseFrontmatter(text) {
  const lines = text.split("\n").map((l) => l.endsWith("\r") ? l.slice(0, -1) : l);
  if (lines.length === 0 || lines[0].trim() !== FRONTMATTER_FENCE) return null;
  let end = -1;
  for (let i = 1; i < lines.length; i++) if (lines[i].trim() === FRONTMATTER_FENCE) {
    end = i;
    break;
  }
  if (end < 0) return null;
  const body = lines.slice(1, end);
  const tools = readList(body, FRONTMATTER_TOOLS_KEY);
  const disallowed = readList(body, FRONTMATTER_DISALLOWED_KEY);
  return { tools: tools !== null && tools.length > 0 ? tools : null, disallowed: disallowed ?? [] };
}
function readList(body, key) {
  for (let i = 0; i < body.length; i++) {
    const line = body[i];
    if (!line.startsWith(key + ":")) continue;
    let value = line.slice(key.length + 1).trim();
    if (value === "") {
      const items = [];
      for (let j = i + 1; j < body.length; j++) {
        const t = body[j].trim();
        if (!t.startsWith("-")) break;
        items.push(unquote(t.slice(1).trim()));
      }
      return items.filter((s) => s !== "");
    }
    if (value.startsWith("[") && value.endsWith("]")) value = value.slice(1, -1);
    return value.split(",").map((s) => unquote(s.trim())).filter((s) => s !== "");
  }
  return null;
}
function unquote(s) {
  if (s.length > 1 && (s[0] === '"' || s[0] === "'") && s.endsWith(s[0])) return s.slice(1, -1);
  return s;
}
function allKnownToolNames(row) {
  const n = row.nativeTools;
  return [
    ...n.shell,
    ...n.read ?? [],
    ...n.grep ?? [],
    ...n.webfetch ?? [],
    ...n.edit ?? [],
    ...TOOL_ORDER.map((t) => row.toolNamePrefix + t)
  ];
}
function norm(row, raw) {
  const p = raw.indexOf("(");
  const name = (p >= 0 ? raw.slice(0, p) : raw).trim();
  if (row.id === "gemini" && name.startsWith(GEMINI_MCP_PREFIX)) return geminiValid(name);
  return name;
}
function geminiValid(s) {
  let out = "";
  for (const ch of s) {
    const ok = ch >= "a" && ch <= "z" || ch >= "A" && ch <= "Z" || ch >= "0" && ch <= "9" || GEMINI_NAME_EXTRA_CHARS.indexOf(ch) >= 0;
    out += ok ? ch : "_";
  }
  return out;
}
function denies(rule, name) {
  if (rule.endsWith("*")) return name.startsWith(rule.slice(0, -1));
  if (rule === name) return true;
  if (rule.startsWith(MCP_SERVER_TOOL_PREFIX)) {
    const server = rule.slice(MCP_SERVER_TOOL_PREFIX.length);
    if (server !== "" && server.indexOf(MCP_NAME_JOIN) < 0) return name.startsWith(rule + MCP_NAME_JOIN);
  }
  return false;
}
function unique(names) {
  return [...new Set(names.filter((n) => n !== ""))];
}

// src/core/policy/unwrap.ts
var NONE = "";
var WRAPPERS = Object.freeze({
  sudo: { valueShorts: "ugpChDrtUTR", valueLongs: ["--user", "--group", "--prompt", "--chdir", "--host"], assignments: true, duration: false, refuseShorts: NONE },
  env: { valueShorts: "uCS", valueLongs: ["--unset", "--chdir", "--split-string"], assignments: true, duration: false, refuseShorts: NONE },
  time: { valueShorts: "fo", valueLongs: ["--format", "--output"], assignments: false, duration: false, refuseShorts: NONE },
  nice: { valueShorts: "n", valueLongs: ["--adjustment"], assignments: false, duration: false, refuseShorts: NONE },
  timeout: { valueShorts: "sk", valueLongs: ["--signal", "--kill-after"], assignments: false, duration: true, refuseShorts: NONE },
  command: { valueShorts: NONE, valueLongs: [], assignments: false, duration: false, refuseShorts: "vV" },
  xargs: { valueShorts: "aEdILnPs", valueLongs: ["--arg-file", "--delimiter", "--max-args", "--max-procs", "--max-chars"], assignments: false, duration: false, refuseShorts: NONE }
});
var SHELLS = ["bash", "sh"];
var SCRIPT_FLAG = "c";
var SHELL_LABEL_SUFFIX = " -c";
var SHELL_VALUE_OPTS = ["-o", "+o", "-O", "+O"];
var OPT2 = "-";
var PLUS_OPT = "+";
var LONG_OPT2 = "--";
var DURATION_SUFFIXES = "smhd";
var DECIMAL = ".";
var isDigit3 = (c) => c !== "" && c >= "0" && c <= "9";
function isDuration(s) {
  if (s === "" || !isDigit3(s.charAt(0))) return false;
  for (let k = 0; k < s.length; k++) {
    const c = s.charAt(k);
    if (isDigit3(c) || c === DECIMAL) continue;
    return k === s.length - 1 && DURATION_SUFFIXES.includes(c);
  }
  return true;
}
function peel(w, args) {
  let k = 0;
  while (k < args.length) {
    const a = args[k];
    if (a === LONG_OPT2) {
      k++;
      break;
    }
    if (w.assignments && isAssignment(a)) {
      k++;
      continue;
    }
    if (a.startsWith(LONG_OPT2)) {
      k++;
      if (w.valueLongs.includes(a)) k++;
      continue;
    }
    if (a.startsWith(OPT2) && a.length > OPT2.length) {
      k++;
      for (const c of w.refuseShorts) if (a.includes(c)) return null;
      for (let j = OPT2.length; j < a.length; j++) {
        if (!w.valueShorts.includes(a.charAt(j))) continue;
        if (j === a.length - 1) k++;
        break;
      }
      continue;
    }
    break;
  }
  if (w.duration) {
    if (k >= args.length || !isDuration(args[k])) return null;
    k++;
  }
  return k < args.length ? args.slice(k) : null;
}
function shellScript(args) {
  let script = false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a.startsWith(LONG_OPT2)) continue;
    if (a.startsWith(OPT2) || a.startsWith(PLUS_OPT)) {
      if (a.includes(SCRIPT_FLAG)) script = true;
      if (SHELL_VALUE_OPTS.includes(a)) k++;
      continue;
    }
    return script ? a : null;
  }
  return null;
}
function inherit(inner, from) {
  const c = { ...inner };
  if (c.insideConstruct === void 0 && from.insideConstruct !== void 0) c.insideConstruct = from.insideConstruct;
  return c;
}
function expand(c, outer, depth, out) {
  const by = [...outer];
  let argv0 = c.argv0;
  let args = c.args;
  let toFile = c.redirectsToFile;
  for (; ; ) {
    const name = argv0.toLowerCase();
    if (SHELLS.includes(name)) {
      const script = shellScript(args);
      const r = script !== null && depth < MAX_NEST_DEPTH ? parseShell(script) : null;
      if (r === null || !r.ok) break;
      for (const inner of r.commands) {
        const spliced = inherit(inner, c);
        spliced.redirectsToFile = inner.redirectsToFile || toFile;
        spliced.endsInBoundedSink = inner.endsInBoundedSink || c.endsInBoundedSink;
        expand(spliced, [...by, name + SHELL_LABEL_SUFFIX], depth + 1, out);
      }
      return;
    }
    const w = Object.hasOwn(WRAPPERS, name) ? WRAPPERS[name] : void 0;
    const rest = w === void 0 ? null : peel(w, args);
    if (rest === null) break;
    by.push(name);
    argv0 = baseName(rest[0]);
    args = rest.slice(1);
    toFile = toFile || writesFile(argv0, args);
  }
  out.push({ ...c, argv0, args, redirectsToFile: toFile, wrappedBy: by });
  if (depth >= MAX_NEST_DEPTH) return;
  for (const s of substitutions(c.raw)) {
    const r = parseShell(s.body);
    if (!r.ok) continue;
    for (const inner of r.commands) expand(inherit(inner, c), [...outer, s.wrapper], depth + 1, out);
  }
}
function unwrap(commands) {
  const out = [];
  for (const c of commands) expand(c, [], 0, out);
  return out;
}

// src/core/policy/user-deny.ts
import { readFileSync as readFileSync2 } from "node:fs";
import { isAbsolute, join as join3, relative, sep } from "node:path";
var CLAUDE_DIR = ".claude";
var CLAUDE_CONFIG_DIR_ENV = "CLAUDE_CONFIG_DIR";
var LOCAL_SETTINGS = "settings.local.json";
var SETTINGS = "settings.json";
var BASH_TOOL = "Bash";
var READ_TOOL = "Read";
var PREFIX_RULE = ":*";
var ABS_ANCHOR = "//";
var HOME_ANCHOR = "~/";
var PROJECT_ANCHOR = "./";
var PARENT = "..";
var WHITESPACE = " 	\n\r";
var BASH_SUBJECT = Object.freeze({ tool: BASH_TOOL });
function denyFiles(projectDir, agent) {
  if (agent !== "claude-code") return [];
  const cfg = process.env[CLAUDE_CONFIG_DIR_ENV];
  const home = homeDirOf(process.env);
  const userDir = cfg !== void 0 && cfg !== "" ? cfg : home === null ? null : join3(home, CLAUDE_DIR);
  const project = [join3(projectDir, CLAUDE_DIR, LOCAL_SETTINGS), join3(projectDir, CLAUDE_DIR, SETTINGS)];
  return userDir === null ? project : [...project, join3(userDir, SETTINGS)];
}
function isObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function readOne(file) {
  let text;
  try {
    text = readFileSync2(file, "utf8");
  } catch (err) {
    return err.code === "ENOENT" ? { kind: "absent" } : { kind: "bad" };
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    return { kind: "bad" };
  }
  if (!isObject(doc)) return { kind: "bad" };
  const perms = doc.permissions;
  if (perms === void 0) return { kind: "ok", deny: [] };
  if (!isObject(perms)) return { kind: "bad" };
  const deny2 = perms.deny;
  if (deny2 === void 0) return { kind: "ok", deny: [] };
  if (!Array.isArray(deny2) || !deny2.every((p) => typeof p === "string")) return { kind: "bad" };
  return { kind: "ok", deny: deny2 };
}
function readUserDeny(projectDir, agent) {
  const out = [];
  for (const file of denyFiles(projectDir, agent)) {
    const r = readOne(file);
    if (r.kind === "bad") return null;
    if (r.kind === "ok") out.push(...r.deny);
  }
  return out;
}
function tokenize(glob, path) {
  const toks = [];
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*" && path && glob[i + 1] === "*") {
      const dir = glob[i + "**".length] === "/";
      toks.push({ t: dir ? "globstarDir" : "globstar" });
      i += dir ? "**/".length : "**".length;
      continue;
    }
    if (c === "*") {
      if (toks.length === 0 || toks[toks.length - 1].t !== "star") toks.push({ t: "star" });
    } else if (c === "?") toks.push({ t: "any1" });
    else toks.push({ t: "lit", c });
    i++;
  }
  return toks;
}
function globMatch(glob, text, path) {
  const toks = tokenize(glob, path);
  const n = text.length;
  let next = new Uint8Array(n + 1);
  next[n] = 1;
  for (let i = toks.length - 1; i >= 0; i--) {
    const tok = toks[i];
    const cur = new Uint8Array(n + 1);
    let acc = 0;
    for (let j = n; j >= 0; j--) {
      const has2 = j < n;
      const ch = has2 ? text[j] : "";
      switch (tok.t) {
        case "lit":
          cur[j] = has2 && ch === tok.c ? next[j + 1] : 0;
          break;
        case "any1":
          cur[j] = has2 && !(path && ch === "/") ? next[j + 1] : 0;
          break;
        case "star":
          cur[j] = next[j] || (has2 && !(path && ch === "/") ? cur[j + 1] : 0);
          break;
        case "globstar":
          cur[j] = next[j] || (has2 ? cur[j + 1] : 0);
          break;
        case "globstarDir":
          if (has2 && ch === "/" && next[j + 1]) acc = 1;
          cur[j] = next[j] || acc;
          break;
      }
    }
    next = cur;
  }
  return next[0] === 1;
}
function parsePattern(pattern) {
  const open = pattern.indexOf("(");
  if (open < 1 || !pattern.endsWith(")")) return null;
  const glob = pattern.slice(open + 1, pattern.length - ")".length);
  return glob === "" ? null : { tool: pattern.slice(0, open), glob };
}
function matchCommand(glob, text) {
  if (!glob.endsWith(PREFIX_RULE)) return globMatch(glob, text, false);
  const head = glob.slice(0, glob.length - PREFIX_RULE.length);
  if (globMatch(head, text, false)) return true;
  for (let k = 0; k < text.length; k++) {
    if (WHITESPACE.includes(text[k]) && globMatch(head, text.slice(0, k), false)) return true;
  }
  return false;
}
var DRIVE_PREFIX = /^[A-Za-z]:(?=\/)/;
function toSlash(p) {
  return sep === "/" ? p : p.split(sep).join("/");
}
function matchPath(glob, absPath, projectDir) {
  if (glob.startsWith(PROJECT_ANCHOR)) {
    if (projectDir === void 0) return false;
    const rel = relative(projectDir, absPath);
    if (rel === "" || rel === PARENT || rel.startsWith(PARENT + sep) || isAbsolute(rel)) return false;
    return globMatch(glob.slice(PROJECT_ANCHOR.length), toSlash(rel), true);
  }
  const target = toSlash(absPath);
  if (glob.startsWith(ABS_ANCHOR)) {
    const g = toSlash(glob.slice(ABS_ANCHOR.length - "/".length));
    return globMatch(g, target, true) || globMatch(g, target.replace(DRIVE_PREFIX, ""), true);
  }
  if (glob.startsWith(HOME_ANCHOR)) {
    const home = homeDirOf(process.env);
    return home !== null && globMatch(toSlash(home) + glob.slice(HOME_ANCHOR.length - "/".length), target, true);
  }
  return globMatch(toSlash(glob), target, true);
}
function matchesAnyDenyPattern(text, patterns, subject = BASH_SUBJECT) {
  for (const pattern of patterns) {
    const p = parsePattern(pattern);
    if (p === null || p.tool !== subject.tool) continue;
    const hit = subject.tool === READ_TOOL ? matchPath(p.glob, text, subject.projectDir) : matchCommand(p.glob, text);
    if (hit) return pattern;
  }
  return null;
}

// src/core/policy/decide.ts
var BASH = "Bash";
var READ = "Read";
var WEBFETCH = "WebFetch";
var CTX_EXECUTE = "ctx_execute";
var CTX_BATCH = "ctx_batch";
var SHELL_LANGUAGE = "shell";
var FLAG_ON = "1";
var OPT3 = "-";
var LONG_OPT3 = "--";
var OPT_VALUE2 = "=";
var HOST_SEP = ".";
var SED_RANGE_SEP = ",";
var SED_PRINT = "p";
var SED_SCRIPT_FLAGS = ["-e", "--expression"];
var COMMAND_STARTS = ";&|(`\n\r";
var ALLOW = Object.freeze({ kind: "allow" });
var deny = (reason) => ({ kind: "deny", reason });
var str = (v) => typeof v === "string" ? v : void 0;
var present = (v) => v !== void 0 && v !== null;
var has = (list2, v) => list2.includes(v);
function decide(ev, row, userDeny) {
  const tool = ev.tool;
  if (tool === void 0) return ALLOW;
  const canonical = tool.canonicalName;
  const input = tool.input;
  let rules;
  if (userDeny === null) {
    if (process.env[REQUIRE_SECURITY_ENV] === FLAG_ON) return deny(POLICY_UNREADABLE_LINE);
    process.stderr.write(POLICY_UNREADABLE_WARNING + "\n");
    rules = [];
  } else rules = userDeny;
  const hit = userDenyHit(canonical, input, ev.cwd, rules);
  if (hit !== null) return deny(USER_DENY_REASON_PREFIX + hit);
  if (canonical === WEBFETCH) return webFetch(input, row);
  if (canonical === BASH) return bash(ev, row, input, rules);
  if (canonical === READ) return read(ev, input);
  return ALLOW;
}
function denyMessage(kind, match, row, intent) {
  const web = kind === "webfetch";
  const tool = web ? DENY_WEBFETCH_TOOLS.map((t) => row.toolNamePrefix + t).join(DENY_WEBFETCH_JOIN) : row.toolNamePrefix + DENY_EXEC_TOOL;
  const call = web ? JSON.stringify({ url: match }) : JSON.stringify({ language: SHELL_LANGUAGE, code: match, intent: intent ?? DENY_INTENT_DEFAULT });
  return [DENY_PREFIX + DENY_WHAT[kind] + DENY_WHAT_SUFFIX, DENY_RUN_HERE_LINE, DENY_TOOL_LABEL + tool, call].join("\n");
}
function readPath(input) {
  for (const k of READ_PATH_KEYS) {
    const p = str(input[k]);
    if (p !== void 0 && p !== "") return p;
  }
  return void 0;
}
function userDenyHit(canonical, input, cwd, rules) {
  if (rules.length === 0) return null;
  const readRule = (p) => matchesAnyDenyPattern(resolve(cwd, p), rules, { tool: READ, projectDir: cwd });
  if (canonical === BASH) {
    const cmd = str(input.command);
    return cmd === void 0 ? null : matchesAnyDenyPattern(cmd, rules);
  }
  if (canonical === READ) {
    const p = readPath(input);
    return p === void 0 ? null : readRule(p);
  }
  if (canonical === CTX_EXECUTE) {
    const file = str(input.file);
    const byFile = file === void 0 || file === "" ? null : readRule(file);
    if (byFile !== null) return byFile;
    const code = str(input.code);
    return input.language === SHELL_LANGUAGE && code !== void 0 ? matchesAnyDenyPattern(code, rules) : null;
  }
  if (canonical === CTX_BATCH && Array.isArray(input.commands)) {
    for (const c of input.commands) {
      const h = typeof c === "string" ? matchesAnyDenyPattern(c, rules) : null;
      if (h !== null) return h;
    }
  }
  return null;
}
function segmentHit(c, rules) {
  if (rules.length === 0) return null;
  return matchesAnyDenyPattern([c.argv0, ...c.args].join(" "), rules) ?? matchesAnyDenyPattern(c.raw, rules);
}
function couldMatch(text, rules) {
  if (rules.length === 0) return false;
  for (let k = 0; k <= text.length; k++) {
    if (k > 0 && !COMMAND_STARTS.includes(text.charAt(k - 1))) continue;
    if (matchesAnyDenyPattern(text.slice(k).trimStart(), rules) !== null) return true;
  }
  return false;
}
function neverDenied(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return false;
  }
  return NEVER_DENY_HOSTS.some((h) => host === h || host.endsWith(HOST_SEP + h));
}
function webFetch(input, row) {
  const url = str(input.url) ?? "";
  return neverDenied(url) ? ALLOW : deny(denyMessage("webfetch", url, row));
}
function bash(ev, row, input, rules) {
  const cmd = str(input.command) ?? "";
  const parsed = parseShell(cmd);
  if (!parsed.ok) return couldMatch(cmd, rules) ? deny(PARSE_ERROR_DENY_LINE) : ALLOW;
  const cmds = unwrap(parsed.commands);
  for (const c of cmds) {
    const h = segmentHit(c, rules);
    if (h !== null) return deny(USER_DENY_REASON_PREFIX + h);
  }
  if (!hasReplace(row) || isSubagentCall(ev)) {
    for (const c of cmds) {
      const kind = denyKind(c);
      if (kind !== null) return deny(denyMessage(kind, cmd, row, str(input.description)));
    }
  }
  return shellDump(cmds, ev.cwd, row) ?? ALLOW;
}
function denyKind(c) {
  const name = c.argv0.toLowerCase();
  if (has(CURL_COMMANDS, name) && bodyReachesOutput(name, c)) return "curl";
  if (inlineHttp(c.raw)) return "http";
  if (has(BUILD_COMMANDS, name)) return "build";
  return null;
}
function bodyReachesOutput(name, c) {
  if (c.redirectsToFile) return !quiet(name, c.args);
  return !c.endsInBoundedSink;
}
function quiet(name, args) {
  const flag = CURL_SILENT_FLAGS[name];
  let silent = false;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === LONG_OPT3) break;
    if (has(CURL_VERBOSE_FLAGS, a)) return false;
    if (a === CURL_DUMP_HEADER_FLAG && args[k + 1] === OPT3) return false;
    if (a === flag.long || a.startsWith(OPT3) && !a.startsWith(LONG_OPT3) && a.includes(flag.short, OPT3.length)) silent = true;
  }
  return silent;
}
function inlineHttp(raw) {
  const low = raw.toLowerCase();
  for (const call of INLINE_HTTP_CALLS) if (low.includes(call)) return true;
  for (let i = low.indexOf(FETCH_CALL); i >= 0; i = low.indexOf(FETCH_CALL, i + 1)) {
    const q = low.charAt(i + FETCH_CALL.length);
    if (q !== "" && FETCH_QUOTES.includes(q) && low.startsWith(HTTP_SCHEME, i + FETCH_CALL.length + q.length)) return true;
  }
  return false;
}
function fileSize(abs) {
  try {
    const st = statSync(abs);
    return st.isFile() ? st.size : -1;
  } catch {
    return -1;
  }
}
function read(ev, input) {
  if (!present(input.offset) && !present(input.limit)) {
    const p = readPath(input);
    if (p !== void 0) {
      const abs = resolve(ev.cwd, p);
      const size = fileSize(abs);
      if (size > OUTPUT_CAP) return deny(READ_DENY_MESSAGE(abs, size));
    }
  }
  return ALLOW;
}
function shellDump(cmds, cwd, row) {
  if (row.nativeTools.read !== void 0 && row.nativeTools.read.length > 0) return null;
  if (cmds.length !== 1) return null;
  const c = cmds[0];
  if (c.redirectsToFile || c.endsInBoundedSink) return null;
  const name = c.argv0.toLowerCase();
  if (!has(SHELL_DUMP_COMMANDS, name)) return null;
  const d = dumpTarget(name, c.args);
  if (d === null) return null;
  if (d.bounded) return ALLOW;
  const abs = resolve(cwd, d.file);
  const size = fileSize(abs);
  return size > OUTPUT_CAP ? deny(READ_DENY_MESSAGE(abs, size)) : null;
}
var allDigits2 = (s) => s !== "" && [...s].every((ch) => ch >= "0" && ch <= "9");
function countFlag(a) {
  if (has(DUMP_COUNT_FLAGS, a)) return 1;
  for (const f of DUMP_COUNT_FLAGS) {
    if (f.startsWith(LONG_OPT3) ? a.startsWith(f + OPT_VALUE2) : a.startsWith(f)) return 0;
  }
  return a.startsWith(OPT3) && allDigits2(a.slice(OPT3.length)) ? 0 : -1;
}
function sedScript(script) {
  if (script === SED_PRINT) return "all";
  if (!script.endsWith(SED_PRINT)) return null;
  const body = script.slice(0, script.length - SED_PRINT.length);
  const comma = body.indexOf(SED_RANGE_SEP);
  const range = comma < 0 ? allDigits2(body) : allDigits2(body.slice(0, comma)) && allDigits2(body.slice(comma + SED_RANGE_SEP.length));
  return range ? "range" : null;
}
function dumpTarget(name, args) {
  const files = [];
  let bounded = false;
  let quietSed = false;
  let script;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (has(DUMP_COUNT_COMMANDS, name)) {
      const skip = countFlag(a);
      if (skip >= 0) {
        bounded = true;
        k += skip;
        continue;
      }
    }
    if (name === SED_COMMAND && has(SED_QUIET_FLAGS, a)) {
      quietSed = true;
      continue;
    }
    if (name === SED_COMMAND && has(SED_SCRIPT_FLAGS, a)) {
      script = args[k + 1];
      k++;
      continue;
    }
    if (a.startsWith(OPT3) && a !== OPT3) continue;
    files.push(a);
  }
  if (name === SED_COMMAND) {
    if (!quietSed) return null;
    if (script === void 0) script = files.shift();
    const kind = script === void 0 ? null : sedScript(script);
    if (kind === null) return null;
    bounded = kind === "range";
  }
  if (name === JQ_COMMAND) {
    if (files.shift() !== JQ_WHITELIST.identity) return null;
  }
  return files.length === 1 && files[0] !== OPT3 ? { file: files[0], bounded } : null;
}

// src/core/project/resolve.ts
import { existsSync, readFileSync as readFileSync3, realpathSync as realpathSync3, statSync as statSync2 } from "node:fs";
import { basename, dirname as dirname2, join as join4, resolve as resolve2 } from "node:path";

// src/core/project/contain.ts
import { realpathSync as realpathSync2 } from "node:fs";
import { dirname, sep as sep2 } from "node:path";
function real(p) {
  try {
    return realpathSync2.native(p);
  } catch {
    return void 0;
  }
}
function components(p) {
  return p.split(sep2).filter((c) => c !== "");
}
function commonRoot(paths) {
  const reals = paths.map(real).filter((r) => r !== void 0);
  if (reals.length === 0) throw new RangeError("commonRoot needs at least one existing path");
  const first = reals[0];
  let n = components(first).length;
  for (const r of reals) {
    const rc = components(r);
    const fc = components(first);
    let i = 0;
    while (i < n && i < rc.length && rc[i] === fc[i]) i += 1;
    n = i;
  }
  let q = first;
  while (components(q).length > n && dirname(q) !== q) q = dirname(q);
  return q;
}

// src/core/project/sha256.ts
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var H0 = [1779033703, 3144134277, 1013904242, 2773480762, 1359893119, 2600822924, 528734635, 1541459225];
var rotr = (x, n) => x >>> n | x << 32 - n;
function sha256Hex(text) {
  const msg = Buffer.from(text, "utf8");
  const bitLen = msg.length * 8;
  const total = Math.ceil((msg.length + 9) / 64) * 64;
  const buf = Buffer.alloc(total);
  msg.copy(buf);
  buf[msg.length] = 128;
  buf.writeUInt32BE(Math.floor(bitLen / 4294967296), total - 8);
  buf.writeUInt32BE(bitLen >>> 0, total - 4);
  const h = H0.slice();
  const w = new Uint32Array(64);
  for (let off = 0; off < total; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = buf.readUInt32BE(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const t1 = hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + (e & f ^ ~e & g) + K[i] + w[i] >>> 0;
      const t2 = (rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + (a & b ^ a & c ^ b & c) >>> 0;
      hh = g;
      g = f;
      f = e;
      e = d + t1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = t1 + t2 >>> 0;
    }
    h[0] = h[0] + a >>> 0;
    h[1] = h[1] + b >>> 0;
    h[2] = h[2] + c >>> 0;
    h[3] = h[3] + d >>> 0;
    h[4] = h[4] + e >>> 0;
    h[5] = h[5] + f >>> 0;
    h[6] = h[6] + g >>> 0;
    h[7] = h[7] + hh >>> 0;
  }
  return h.map((x) => x.toString(16).padStart(8, "0")).join("");
}

// src/core/project/resolve.ts
function sourceOf(agent) {
  switch (agent) {
    case "claude-code":
      return "env:CLAUDE_PROJECT_DIR";
    case "codex":
    case "copilot-cli":
    case "kiro":
      return "arg:--agent+cwd";
    case "vscode":
      return "arg:workspaceFolder";
    case "gemini":
    case "qwen":
    case "zcode":
    case "opencode":
      return "spawn-cwd";
    case "pi":
      return "pi:ctx.cwd";
  }
}
function present2(v) {
  return v === void 0 || v === "" ? void 0 : v;
}
function dirOf(kind, src) {
  switch (kind) {
    case "env:CLAUDE_PROJECT_DIR":
      return present2(src.env.CLAUDE_PROJECT_DIR) ?? present2(src.cwd) ?? process.cwd();
    case "arg:--agent+cwd":
    case "spawn-cwd":
      return present2(src.cwd);
    case "arg:workspaceFolder": {
      const i = src.argv.indexOf(WORKSPACE_FOLDER_FLAG);
      return i < 0 ? void 0 : present2(src.argv[i + 1]);
    }
    case "pi:ctx.cwd":
      return present2(src.piCwd);
  }
}
function gitDirs(dir) {
  let cur;
  try {
    cur = realpathSync3.native(dir);
  } catch {
    throw new CtxError("NO_GIT_DIR", { path: dir });
  }
  for (; ; ) {
    const gitDir = gitDirAt(join4(cur, GIT_DIR_NAME));
    if (gitDir !== null) {
      const common = firstLine(join4(gitDir, GIT_COMMONDIR_FILE));
      return { commonDir: realpathSync3.native(common === null ? gitDir : resolve2(gitDir, common)), worktree: cur };
    }
    const up = dirname2(cur);
    if (up === cur) return null;
    cur = up;
  }
}
function gitDirAt(dotGit) {
  let gitDir;
  try {
    if (statSync2(dotGit).isDirectory()) {
      gitDir = dotGit;
    } else {
      const line = firstLine(dotGit);
      if (line === null || !line.startsWith(GITDIR_FILE_PREFIX)) return null;
      gitDir = resolve2(dirname2(dotGit), line.slice(GITDIR_FILE_PREFIX.length));
    }
  } catch {
    return null;
  }
  return existsSync(join4(gitDir, GIT_HEAD_FILE)) ? gitDir : null;
}
function firstLine(file) {
  let text;
  try {
    text = readFileSync3(file, "utf8");
  } catch {
    return null;
  }
  const nl = text.indexOf("\n");
  const line = (nl < 0 ? text : text.slice(0, nl)).trim();
  return line === "" ? null : line;
}
function git(dir, args) {
  const { spawnSync } = process.getBuiltinModule("node:child_process");
  const r = spawnSync("git", args, { cwd: dir, shell: false, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.error !== void 0 || r.status !== 0) throw new CtxError("NO_GIT_DIR", { path: dir });
  return r.stdout.split("\n").filter((l) => l !== "");
}
function containmentRootOf(dir, commonDir) {
  const repoDir = basename(commonDir) === GIT_DIR_NAME ? dirname2(commonDir) : commonDir;
  const worktrees = git(dir, ["worktree", "list", "--porcelain"]).filter((l) => l.startsWith(GIT_WORKTREE_LINE_PREFIX)).map((l) => l.slice(GIT_WORKTREE_LINE_PREFIX.length));
  return commonRoot([dirname2(repoDir), ...worktrees]);
}
function resolveProject(agent, src) {
  const source = sourceOf(agent);
  const dir = dirOf(source, src);
  if (dir === void 0) throw new CtxError("NO_PROJECT", { kind: source });
  const repo = gitDirs(dir);
  const plain = repo === null ? realpathSync3.native(dir) : void 0;
  const commonDir = repo?.commonDir ?? plain;
  const worktree = repo?.worktree ?? plain;
  const projectKey = sha256Hex(commonDir).slice(0, PROJECT_KEY_HEX_LEN);
  const projectDir = join4(resolveConfigDir(process.env), PROJECTS_DIR_NAME, projectKey);
  let root;
  return {
    projectKey,
    projectDir,
    dbPath: join4(projectDir, DB_FILE_NAME),
    worktree,
    get containmentRoot() {
      root ??= plain ?? containmentRootOf(dir, commonDir);
      return root;
    },
    agent,
    source
  };
}

// src/core/store/db.ts
import { existsSync as existsSync2, linkSync, mkdirSync as mkdirSync2, rmSync } from "node:fs";

// src/core/store/schema.ts
var SCHEMA_VERSION2 = SCHEMA_VERSION;
var PRAGMAS = `
PRAGMA busy_timeout = ${DB_TIMEOUT_MS};
PRAGMA journal_mode = WAL;
`;
var FTS_TOKENIZE = "tokenize = 'unicode61 remove_diacritics 2'";
var DDL = `
CREATE TABLE IF NOT EXISTS events (
  seq            INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id     TEXT NOT NULL,
  worktree       TEXT NOT NULL,
  agent          TEXT NOT NULL,
  kind           TEXT NOT NULL CHECK (kind IN ('prompt','edit','cmd','toolerr','index','cost','decision')),
  tool           TEXT,
  key            TEXT,
  path           TEXT,
  ok             INTEGER,
  exit_code      INTEGER,
  bytes          INTEGER,
  body           TEXT,
  turn           INTEGER NOT NULL,
  sandbox_bytes  INTEGER NOT NULL DEFAULT 0,
  returned_bytes INTEGER NOT NULL DEFAULT 0,
  created_at     INTEGER NOT NULL,
  accessed_at    INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_session_kind_seq ON events(session_id, kind, seq);
CREATE INDEX IF NOT EXISTS idx_events_session_kind_key_seq ON events(session_id, kind, key, seq);

CREATE TABLE IF NOT EXISTS sources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  worktree    TEXT NOT NULL,
  agent       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('path','content','url')),
  label       TEXT NOT NULL,
  bytes_total INTEGER NOT NULL,
  chunk_count INTEGER NOT NULL,
  created_ts  INTEGER NOT NULL,
  created_at  TEXT NOT NULL,
  accessed_ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sources_accessed ON sources(accessed_ts);

CREATE VIRTUAL TABLE IF NOT EXISTS chunks USING fts5(
  source_id UNINDEXED,
  session_id UNINDEXED,
  worktree UNINDEXED,
  agent UNINDEXED,
  ord UNINDEXED,
  body,
  ${FTS_TOKENIZE}
);

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
var DDL_V2 = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_events_cost_session_turn ON events(session_id, turn) WHERE kind = 'cost';
`;
var MIGRATIONS = [
  { version: 1, sql: DDL },
  { version: 2, sql: DDL_V2 }
];
function applyMigrations(db, fromVersion) {
  if (fromVersion === SCHEMA_VERSION2) return;
  if (fromVersion > SCHEMA_VERSION2) {
    throw new CtxError("SCHEMA_STALE", { found: fromVersion, want: SCHEMA_VERSION2 });
  }
  db.exec(PRAGMAS);
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const step of MIGRATIONS) {
      if (step.version > fromVersion) db.exec(step.sql);
    }
    db.exec(`PRAGMA user_version = ${SCHEMA_VERSION2}`);
    db.exec("COMMIT");
  } catch (err) {
    if (db.isTransaction) db.exec("ROLLBACK");
    throw err;
  }
}

// src/core/store/db.ts
function versionParts(v) {
  const bare = v.startsWith("v") ? v.slice(1) : v;
  return bare.split(".").map((p) => Number.parseInt(p, 10));
}
function isBelow(found, min) {
  const a = versionParts(found);
  const b = versionParts(min);
  for (let i = 0; i < b.length; i += 1) {
    const x = a[i] ?? 0;
    if (x !== b[i]) return x < b[i];
  }
  return false;
}
function isCorrupt(err) {
  if (typeof err !== "object" || err === null) return false;
  const code = err.errcode;
  if (typeof code !== "number") return false;
  const primary = code & SQLITE_PRIMARY_CODE_MASK;
  return primary === SQLITE_CORRUPT_CODE || primary === SQLITE_NOTADB_CODE;
}
async function loadSqlite() {
  try {
    return await import("node:sqlite");
  } catch {
    throw new CtxError("NO_SQLITE");
  }
}
function readUserVersion(raw) {
  const row = raw.prepare("PRAGMA user_version").get();
  return row.user_version;
}
function createAtomically(sqlite, path) {
  const { randomUUID } = process.getBuiltinModule("node:crypto");
  const tmp = path + "." + randomUUID() + DB_TMP_SUFFIX;
  try {
    const raw = new sqlite.DatabaseSync(tmp, { timeout: DB_TIMEOUT_MS });
    try {
      applyMigrations(raw, readUserVersion(raw));
    } finally {
      raw.close();
    }
    try {
      linkSync(tmp, path);
    } catch (err) {
      if (err.code !== "EEXIST") throw err;
    }
  } finally {
    for (const suffix of ["", DB_WAL_SUFFIX, DB_SHM_SUFFIX]) rmSync(tmp + suffix, { force: true });
  }
}
function openWritable(sqlite, path) {
  let raw = null;
  try {
    if (!existsSync2(path)) createAtomically(sqlite, path);
    raw = new sqlite.DatabaseSync(path, { timeout: DB_TIMEOUT_MS });
    applyMigrations(raw, readUserVersion(raw));
    return raw;
  } catch (err) {
    if (raw) raw.close();
    throw err;
  }
}
function openReadOnly(sqlite, path) {
  const raw = new sqlite.DatabaseSync(path, { timeout: DB_TIMEOUT_MS, readOnly: true });
  try {
    const found = readUserVersion(raw);
    if (found !== SCHEMA_VERSION) throw new CtxError("SCHEMA_STALE", { found, want: SCHEMA_VERSION });
    return raw;
  } catch (err) {
    raw.close();
    throw err;
  }
}
async function openDb(project, opts) {
  if (isBelow(process.version, NODE_MIN)) throw new CtxError("NODE_TOO_OLD", { v: process.version });
  const sqlite = await loadSqlite();
  mkdirSync2(project.projectDir, { recursive: true });
  const path = project.dbPath;
  const sibling = existsSync2(path + DB_WAL_SUFFIX) || existsSync2(path + DB_SHM_SUFFIX);
  if (sibling && !existsSync2(path)) {
    throw new CtxError("DB_GONE");
  }
  try {
    let raw;
    if (opts?.readOnly === true) {
      if (!existsSync2(path)) openWritable(sqlite, path).close();
      raw = openReadOnly(sqlite, path);
    } else {
      raw = openWritable(sqlite, path);
    }
    return { raw, projectKey: project.projectKey, path };
  } catch (err) {
    if (isCorrupt(err)) throw new CtxError("DB_CORRUPT");
    throw err;
  }
}
function withWrite(db, fn) {
  db.raw.exec("BEGIN IMMEDIATE");
  try {
    const result = fn(db);
    db.raw.exec("COMMIT");
    return result;
  } catch (err) {
    if (db.raw.isTransaction) db.raw.exec("ROLLBACK");
    throw err;
  }
}
function inWrite(db, fn) {
  return db.raw.isTransaction ? fn(db) : withWrite(db, fn);
}
function metaGet(db, key) {
  const row = db.raw.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row === void 0 ? null : row.value;
}
function metaSet(db, key, v) {
  inWrite(db, (h) => {
    h.raw.prepare("INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, v);
  });
}
function metaTake(db, key) {
  return inWrite(db, (h) => {
    const row = h.raw.prepare("DELETE FROM meta WHERE key = ? RETURNING value").get(key);
    return row === void 0 ? null : row.value;
  });
}

// src/core/journal/append.ts
var COLUMNS = "events(session_id, worktree, agent, kind, tool, key, path, ok, exit_code, bytes, body, turn, sandbox_bytes, returned_bytes, created_at, accessed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
var INSERT_SQL = "INSERT INTO " + COLUMNS;
var INSERT_COST_SQL = "INSERT OR IGNORE INTO " + COLUMNS;
var COST_SEQ_SQL = "SELECT seq FROM events WHERE kind = 'cost' AND session_id = ? AND turn = ?";
function appendEvent(db, row) {
  return withWrite(db, (h) => {
    const now = Date.now();
    const isCost = row.kind === "cost";
    const res = h.raw.prepare(isCost ? INSERT_COST_SQL : INSERT_SQL).run(
      row.session_id,
      row.worktree,
      row.agent,
      row.kind,
      row.tool,
      row.key,
      row.path,
      row.ok,
      row.exit_code,
      row.bytes,
      row.body,
      row.turn,
      row.sandbox_bytes,
      row.returned_bytes,
      now,
      now
    );
    if (res.changes === 1) return Number(res.lastInsertRowid);
    const kept = h.raw.prepare(COST_SEQ_SQL).get(row.session_id, row.turn);
    return kept.seq;
  });
}
function canonicalKey(tool, code) {
  let out = "";
  let quote = "";
  let escaped = false;
  let gap = false;
  for (const ch of code) {
    if (quote === "" && !escaped && ch.trim() === "") {
      gap = out !== "";
      continue;
    }
    if (gap) {
      out += " ";
      gap = false;
    }
    out += ch;
    if (escaped) {
      escaped = false;
    } else if (ch === "\\" && quote !== "'") {
      escaped = true;
    } else if (quote === "" && (ch === "'" || ch === '"')) {
      quote = ch;
    } else if (ch === quote) {
      quote = "";
    }
  }
  return tool + ":" + out;
}

// src/core/journal/read.ts
function readSessionEvents(db, sessionId, kind) {
  if (sessionId === "") return [];
  if (kind === void 0) {
    return db.raw.prepare("SELECT * FROM events WHERE session_id = ? ORDER BY seq ASC").all(sessionId);
  }
  return db.raw.prepare("SELECT * FROM events WHERE session_id = ? AND kind = ? ORDER BY seq ASC").all(sessionId, kind);
}
function readLastPrompt(db, sessionId) {
  if (sessionId === "") return "";
  const row = db.raw.prepare("SELECT body FROM events WHERE session_id = ? AND kind = 'prompt' ORDER BY seq DESC LIMIT 1").get(sessionId);
  return row === void 0 ? "" : row.body;
}
function readRecallRows(db, sessionId, worktree, limit) {
  if (sessionId === "") return [];
  return db.raw.prepare("SELECT * FROM events WHERE kind <> 'cost' AND (session_id = ? OR worktree = ?) ORDER BY seq DESC LIMIT ?").all(sessionId, worktree, limit);
}

// src/core/compaction/candidates.ts
function firstLine2(body) {
  const nl = body.indexOf("\n");
  return (nl < 0 ? body : body.slice(0, nl)).replaceAll("\r", " ");
}
function make(section, row, text, repeatCount, query) {
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes < 1) throw new Error("compaction: empty candidate line (DECISIONS-r9 M9).");
  return { section, seq: row.seq, turn: row.turn, text, bytes, repeatCount, pinned: section === "last_request", query };
}
function capSection(list2) {
  return list2.length > MAX_CANDIDATES ? list2.slice(list2.length - MAX_CANDIDATES) : list2;
}
function emptySet() {
  return { lastRequest: null, openErrors: [], changedFiles: [], decisions: [], earlierRequests: [], indexedSources: [] };
}
function buildCandidates(rows, sessionId) {
  if (!sessionId) return emptySet();
  const own2 = rows.filter((r) => r.session_id === sessionId).sort((a, b) => a.seq - b.seq);
  const prompts = own2.filter((r) => r.kind === "prompt");
  const last = prompts.length > 0 ? prompts[prompts.length - 1] : void 0;
  const lastRequest = last === void 0 ? null : make("last_request", last, "now: " + firstLine2(last.body), 1, null);
  const earlierRequests = prompts.slice(0, prompts.length - 1).map((r) => make("earlier_requests", r, "asked #" + r.seq + ": " + firstLine2(r.body), 1, null));
  const failures = /* @__PURE__ */ new Map();
  const lastOk = /* @__PURE__ */ new Map();
  for (const r of own2) {
    if (r.kind !== "cmd" && r.kind !== "toolerr" || r.key === null) continue;
    if (r.ok === 1) {
      lastOk.set(r.key, r.seq);
      continue;
    }
    failures.set(r.key, { row: r, count: (failures.get(r.key)?.count ?? 0) + 1 });
  }
  const openErrors = [];
  for (const [key, f] of failures) {
    if ((lastOk.get(key) ?? 0) > f.row.seq) continue;
    openErrors.push(make("open_errors", f.row, "error #" + f.row.seq + " " + (f.row.tool ?? "") + ": " + key, f.count, key));
  }
  openErrors.sort((a, b) => a.seq - b.seq);
  const edits = /* @__PURE__ */ new Map();
  for (const r of own2) {
    if (r.kind !== "edit" || r.path === null) continue;
    edits.set(r.path, { row: r, count: (edits.get(r.path)?.count ?? 0) + 1 });
  }
  const changedFiles = [];
  for (const [path, e] of edits) {
    const c = make("changed_files", e.row, "edited " + path + " x" + e.count, e.count, path);
    changedFiles.push({ ...c, editCount: e.count });
  }
  changedFiles.sort((a, b) => a.seq - b.seq);
  const decided = /* @__PURE__ */ new Map();
  for (const r of own2) {
    if (r.kind !== "decision" || r.body === "") continue;
    const key = r.key ?? r.body;
    decided.set(key, { row: r, count: (decided.get(key)?.count ?? 0) + 1 });
  }
  const decisions = [];
  for (const [key, d] of decided) decisions.push(make("decisions", d.row, "decided #" + d.row.seq + ": " + firstLine2(d.row.body), d.count, key));
  decisions.sort((a, b) => a.seq - b.seq);
  const indexedSources = own2.filter((r) => r.kind === "index").map((r) => make("indexed_sources", r, "indexed " + (r.key ?? ""), 1, r.key));
  const set = {
    lastRequest,
    openErrors: capSection(openErrors),
    changedFiles: capSection(changedFiles),
    decisions: capSection(decisions),
    earlierRequests: capSection(earlierRequests),
    indexedSources: capSection(indexedSources)
  };
  const rest = [...set.openErrors, ...set.changedFiles, ...set.decisions, ...set.earlierRequests, ...set.indexedSources];
  const total = rest.length + (lastRequest === null ? 0 : 1);
  if (total <= MAX_CANDIDATES_TOTAL) return set;
  const drop = new Set(rest.map((c) => c.seq).sort((a, b) => a - b).slice(0, total - MAX_CANDIDATES_TOTAL));
  return {
    lastRequest,
    openErrors: set.openErrors.filter((c) => !drop.has(c.seq)),
    changedFiles: set.changedFiles.filter((c) => !drop.has(c.seq)),
    decisions: set.decisions.filter((c) => !drop.has(c.seq)),
    earlierRequests: set.earlierRequests.filter((c) => !drop.has(c.seq)),
    indexedSources: set.indexedSources.filter((c) => !drop.has(c.seq))
  };
}

// src/core/compaction/score.ts
function scoreCandidate(input) {
  if (!Object.hasOwn(WEIGHT, input.section)) {
    throw new Error(`compaction: "${String(input.section)}" has no weight; only toolerr, decision, prompt, edit and index rows are scored (ADR-0009 \xA73, DECISIONS-r11).`);
  }
  const age = Math.max(0, input.currentTurn - input.itemTurn);
  const decay = DECAY_X1000[Math.min(age, DECAY_X1000.length - 1)];
  let bonus = 1;
  for (let n = Math.max(1, input.repeatCount); n > 1; n >>= 1) bonus += 1;
  return Math.round(WEIGHT[input.section] * decay * bonus / DECAY_SCALE);
}
function weightKey(section) {
  switch (section) {
    case "last_request":
    case "earlier_requests":
      return "prompt";
    case "open_errors":
      return "toolerr";
    case "changed_files":
      return "edit";
    case "decisions":
      return "decision";
    case "indexed_sources":
      return "index";
  }
}
function scoreCandidates(candidates, currentTurn) {
  return candidates.map((c) => ({
    ...c,
    score: scoreCandidate({ section: weightKey(c.section), currentTurn, itemTurn: c.turn, repeatCount: c.repeatCount })
  }));
}

// src/core/compaction/render.ts
function bytesOf(s) {
  return Buffer.byteLength(s, "utf8");
}
function lineOf(c) {
  return c.bytes > POINTER_MIN ? "#" + c.seq + " (" + c.bytes + " B) ctx_resume(seq:" + c.seq + ")" : c.text;
}
function moreLine(queries) {
  return "more: ctx_search(queries:" + JSON.stringify(queries) + ', scope:"session")';
}
function renderState(rows, turn) {
  let newest;
  for (const r of rows) if (newest === void 0 || r.seq > newest.seq) newest = r;
  const sessionId = newest === void 0 ? "" : newest.session_id;
  const upto = newest === void 0 || sessionId === "" ? 0 : newest.seq;
  const set = buildCandidates(rows, sessionId);
  const openTag = `<context_mode_state session="${sessionId}" upto="${upto}">`;
  const emptyMoreBytes = bytesOf(moreLine([]));
  const budget = STATE_BUDGET - (bytesOf(openTag) + 1 + emptyMoreBytes + 1 + bytesOf(STATE_CLOSE_TAG));
  let used = 0;
  const pinnedLine = set.lastRequest === null ? null : lineOf(set.lastRequest);
  if (pinnedLine !== null) used += bytesOf(pinnedLine) + 1;
  const remaining = scoreCandidates(
    [...set.openErrors, ...set.changedFiles, ...set.decisions, ...set.earlierRequests, ...set.indexedSources],
    turn
  );
  const k = /* @__PURE__ */ new Map();
  const taken = [];
  const skipped = [];
  while (remaining.length > 0) {
    let best = 0;
    let bestRatio = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const c2 = remaining[i];
      const ratio = c2.score * RATIO_SECTION_DECAY ** (k.get(c2.section) ?? 0) / c2.bytes;
      if (ratio > bestRatio || ratio === bestRatio && c2.seq > remaining[best].seq) {
        best = i;
        bestRatio = ratio;
      }
    }
    const c = remaining.splice(best, 1)[0];
    const lineBytes = bytesOf(lineOf(c)) + 1;
    if (used + lineBytes <= budget) {
      used += lineBytes;
      taken.push(c);
      k.set(c.section, (k.get(c.section) ?? 0) + 1);
    } else {
      skipped.push(c);
    }
  }
  const lines = [openTag];
  if (pinnedLine !== null) lines.push(pinnedLine);
  for (const section of ["open_errors", "changed_files", "decisions", "earlier_requests", "indexed_sources"]) {
    for (const c of taken.filter((t) => t.section === section).sort((a, b) => a.seq - b.seq)) lines.push(lineOf(c));
  }
  const queries = [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of skipped.sort((a, b) => a.seq - b.seq)) {
    if (c.query === null || seen.has(c.query)) continue;
    if (bytesOf(moreLine([...queries, c.query])) - emptyMoreBytes > budget - used) break;
    queries.push(c.query);
    seen.add(c.query);
  }
  lines.push(moreLine(queries), STATE_CLOSE_TAG);
  return lines.join("\n");
}

// src/core/store/fts.ts
var INSERT_SOURCE = `
INSERT INTO sources(session_id, worktree, agent, kind, label, bytes_total, chunk_count, created_ts, created_at, accessed_ts)
VALUES (:session_id, :worktree, :agent, :kind, :label, :bytes_total, :chunk_count, :created_ts, :created_at, :created_ts)
RETURNING id`;
var INSERT_CHUNK = `
INSERT INTO chunks(source_id, session_id, worktree, agent, ord, body) VALUES (?, ?, ?, ?, ?, ?)`;
var ESCAPES = Object.freeze({ "&": "&amp;", "<": "&lt;", ">": "&gt;" });
function ftsInsert(db, src, chunks) {
  let total = 0;
  for (const c of chunks) total += c.bytes;
  const batches = [];
  let batch = [];
  let batchBytes = 0;
  for (const c of chunks) {
    if (batch.length > 0 && batchBytes + c.bytes > INDEX_WRITE_CHUNK) {
      batches.push(batch);
      batch = [];
      batchBytes = 0;
    }
    batch.push(c);
    batchBytes += c.bytes;
  }
  batches.push(batch);
  let id = 0;
  batches.forEach((rows, i) => {
    withWrite(db, (h) => {
      if (i === 0) {
        const row = h.raw.prepare(INSERT_SOURCE).get({
          session_id: src.sessionId,
          worktree: src.worktree,
          agent: src.agent,
          kind: src.kind,
          label: src.label,
          bytes_total: total,
          chunk_count: chunks.length,
          created_ts: src.createdAt,
          created_at: new Date(src.createdAt).toISOString()
        });
        id = Number(row.id);
      }
      const ins = h.raw.prepare(INSERT_CHUNK);
      for (const c of rows) ins.run(id, src.sessionId, src.worktree, src.agent, c.ord, c.text);
    });
  });
  return id;
}
function toMatch(q) {
  const words = [];
  let cur = "";
  for (const ch of q) {
    if (ch.trim() === "") {
      if (cur !== "") words.push(cur);
      cur = "";
    } else {
      cur += ch === '"' ? '""' : ch;
    }
  }
  if (cur !== "") words.push(cur);
  return words.map((w) => `"${w}"*`).join(" ");
}
function toMatchAny(q) {
  const terms = new Set(toMatch(q).split(" ").filter((t) => t !== ""));
  return [...terms].join(" OR ");
}
var TL_SCOPE = `
    AND (:scope <> 'session' OR session_id = :session_id)
    AND (:scope <> 'worktree' OR worktree = :worktree)`;
var TL_EVENTS = `
WITH e AS (
  SELECT seq, kind, key, path, body, created_at FROM events
  WHERE created_at > :after${TL_SCOPE}
    AND (:source IS NULL OR kind = :source)
)
SELECT seq, kind, key, path, body, created_at FROM e
WHERE created_at <= IFNULL((SELECT created_at FROM e ORDER BY created_at, seq LIMIT 1 OFFSET :off), created_at)
ORDER BY created_at ASC, seq ASC`;
var TL_SOURCES = `
WITH s AS (
  SELECT id, label, created_ts FROM sources
  WHERE created_ts > :after${TL_SCOPE}
    AND (:source IS NULL OR label = :source)
    AND label <> :reserved
)
SELECT id, label, created_ts FROM s
WHERE created_ts <= IFNULL((SELECT created_ts FROM s ORDER BY created_ts, id LIMIT 1 OFFSET :off), created_ts)
ORDER BY created_ts ASC, id ASC`;
var TL_MORE = `
SELECT EXISTS(SELECT 1 FROM events WHERE created_at > :after${TL_SCOPE} AND (:source IS NULL OR kind = :source))
    OR EXISTS(SELECT 1 FROM sources WHERE created_ts > :after${TL_SCOPE} AND (:source IS NULL OR label = :source)
                 AND label <> :reserved) AS more`;
var RANK_DDL = `CREATE VIRTUAL TABLE r USING fts5(body, ${FTS_TOKENIZE}, content='')`;
var RANK_INSERT = "INSERT INTO r(rowid, body) VALUES (?, ?)";
var RANK_QUERY = "SELECT rowid AS id, bm25(r) AS bm FROM r WHERE r MATCH ?";
function rankTexts(texts, q, mode = "all") {
  const scores = texts.map(() => 0);
  const match = mode === "any" ? toMatchAny(q) : toMatch(q);
  if (match === "" || texts.length === 0) return scores;
  const sqlite = process.getBuiltinModule("node:sqlite");
  if (sqlite === void 0) throw new CtxError("NO_SQLITE");
  const mem = new sqlite.DatabaseSync(":memory:");
  try {
    mem.exec(RANK_DDL);
    const ins = mem.prepare(RANK_INSERT);
    mem.exec("BEGIN");
    for (let i = 0; i < texts.length; i++) ins.run(i + 1, texts[i]);
    mem.exec("COMMIT");
    for (const r of mem.prepare(RANK_QUERY).all(match)) {
      scores[Number(r.id) - 1] = -r.bm;
    }
    return scores;
  } finally {
    mem.close();
  }
}

// src/core/compaction/recall.ts
var NONE2 = { text: "", seqs: [] };
function bytesOf2(s) {
  return Buffer.byteLength(s, "utf8");
}
function textOf(r) {
  return [r.key ?? "", r.path ?? "", r.body].filter((t) => t !== "").join("\n");
}
function recallLine(r) {
  return "#" + r.seq + " " + r.kind + (r.tool === null ? "" : " " + r.tool) + ": " + textOf(r);
}
function pickRecall(rows, prompt, seen) {
  if (prompt.trim() === "") return NONE2;
  const pool = rows.filter((r) => !seen.has(r.seq) && r.kind !== "cost" && !(r.kind === "prompt" && r.body === prompt) && textOf(r) !== "");
  if (pool.length === 0) return NONE2;
  const scores = rankTexts(pool.map(textOf), prompt, "any");
  const order = pool.map((r, i) => ({ r, score: scores[i] })).filter((x) => x.score >= RECALL_MIN_SCORE).sort((a, b) => b.score - a.score || b.r.seq - a.r.seq);
  if (order.length === 0) return NONE2;
  let used = bytesOf2(RECALL_OPEN_TAG) + 1 + bytesOf2(RECALL_CLOSE_TAG);
  const taken = [];
  for (const { r } of order) {
    const cost = bytesOf2(recallLine(r)) + 1;
    if (used + cost > RECALL_BUDGET_BYTES) continue;
    used += cost;
    taken.push(r);
  }
  if (taken.length === 0) return NONE2;
  taken.sort((a, b) => a.seq - b.seq);
  return { text: [RECALL_OPEN_TAG, ...taken.map(recallLine), RECALL_CLOSE_TAG].join("\n"), seqs: taken.map((r) => r.seq) };
}

// src/core/index/chunk.ts
var VOID_TAGS = /* @__PURE__ */ new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
var RAW_TAGS = /* @__PURE__ */ new Set(["script", "style"]);
var encoder = new TextEncoder();
function chunkText(text, kind, maxBytes = MAX_CHUNK_BYTES) {
  const src = normalize(text);
  if (src.length === 0) return [];
  const blocks = kind === "html" ? htmlBlocks(src) : lineBlocks(src, kind === "md");
  const cap = Math.max(4, Math.min(MAX_CHUNK_BYTES, Math.floor(maxBytes)));
  return merge(src, blocks, kind !== "text", cap, cap < MAX_CHUNK_BYTES);
}
function normalize(text) {
  const lf = text.split("\r\n").join("\n");
  return lf.startsWith("\uFEFF") ? lf.slice(1) : lf;
}
function lineBlocks(src, md) {
  const out = [];
  let start = -1;
  let end = -1;
  let inTable = false;
  let fence = "";
  const close = () => {
    if (start >= 0) out.push({ start, end });
    start = -1;
  };
  const add = (from, to, table) => {
    if (start < 0) start = from;
    end = to;
    inTable = table;
  };
  let pos = 0;
  while (pos <= src.length) {
    const nl = src.indexOf("\n", pos);
    const eol = nl < 0 ? src.length : nl;
    const line = src.slice(pos, eol);
    if (fence !== "") {
      add(pos, eol, false);
      if (closesFence(line, fence)) fence = "";
    } else if (line.length === 0) {
      close();
    } else {
      const opener = md ? fenceOf(line) : "";
      const table = md && opener === "" && line.includes("|");
      if (md && start >= 0 && table !== inTable) close();
      add(pos, eol, table);
      fence = opener;
    }
    pos = eol + 1;
  }
  close();
  return out;
}
function fenceOf(line) {
  const t = line.trimStart();
  if (!t.startsWith("```") && !t.startsWith("~~~")) return "";
  let n = 0;
  while (n < t.length && t[n] === t[0]) n += 1;
  return t.slice(0, n);
}
function closesFence(line, fence) {
  const t = line.trim();
  if (t.length < fence.length) return false;
  for (let i = 0; i < t.length; i += 1) if (t[i] !== fence[0]) return false;
  return true;
}
function htmlBlocks(src) {
  const out = [];
  const open = /* @__PURE__ */ new Map();
  let depth = 0;
  let blockStart = 0;
  let i = 0;
  const split = (at2) => {
    pushTrimmed(out, src, blockStart, at2);
    blockStart = at2;
  };
  while (i < src.length) {
    if (src[i] !== "<") {
      i += 1;
      continue;
    }
    if (src.startsWith("<!--", i)) {
      const e = src.indexOf("-->", i + "<!--".length);
      i = e < 0 ? src.length : e + "-->".length;
      continue;
    }
    const tag2 = readTag(src, i);
    if (tag2 === void 0) {
      i += 1;
      continue;
    }
    i = tag2.end;
    if (tag2.close) {
      const n = open.get(tag2.name) ?? 0;
      if (n === 0) continue;
      open.set(tag2.name, n - 1);
      depth -= 1;
      if (depth === 0) split(i);
      continue;
    }
    if (tag2.selfClose || VOID_TAGS.has(tag2.name)) continue;
    if (RAW_TAGS.has(tag2.name)) {
      i = rawEnd(src, i, tag2.name);
      if (depth === 0) split(i);
      continue;
    }
    open.set(tag2.name, (open.get(tag2.name) ?? 0) + 1);
    depth += 1;
  }
  pushTrimmed(out, src, blockStart, src.length);
  return out;
}
function isLetter(c) {
  return c >= "a" && c <= "z" || c >= "A" && c <= "Z";
}
function isNameChar(c) {
  return isLetter(c) || c >= "0" && c <= "9" || c === "-" || c === ":";
}
function readTag(src, i) {
  let j = i + 1;
  const close = src[j] === "/";
  if (close) j += 1;
  if (j >= src.length || !isLetter(src[j])) return void 0;
  const nameStart = j;
  while (j < src.length && isNameChar(src[j])) j += 1;
  const name = src.slice(nameStart, j).toLowerCase();
  let quote = "";
  while (j < src.length) {
    const c = src[j];
    if (quote !== "") {
      if (c === quote) quote = "";
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === ">") {
      break;
    }
    j += 1;
  }
  if (j >= src.length) return void 0;
  return { name, close, selfClose: src[j - 1] === "/", end: j + 1 };
}
function rawEnd(src, from, name) {
  let k = src.indexOf("</", from);
  while (k >= 0) {
    const after = k + "</".length + name.length;
    const named = src.slice(k + "</".length, after).toLowerCase() === name;
    if (named && (after >= src.length || !isNameChar(src[after]))) {
      const gt = src.indexOf(">", after);
      return gt < 0 ? src.length : gt + 1;
    }
    k = src.indexOf("</", k + "</".length);
  }
  return src.length;
}
function isSpace(c) {
  return c === " " || c === "\n" || c === "	" || c === "\f" || c === "\r";
}
function pushTrimmed(out, src, start, end) {
  let s = start;
  let e = end;
  while (s < e && isSpace(src[s])) s += 1;
  while (e > s && isSpace(src[e - 1])) e -= 1;
  if (s < e) out.push({ start: s, end: e });
}
function utf8Bytes(s) {
  return Buffer.byteLength(s, "utf8");
}
function cutPoint(src, start, end, scratch) {
  let limit = Math.min(end, start + scratch.length);
  if (limit < end && [...src.slice(limit - 1, limit + 1)].length === 1) limit -= 1;
  const r = encoder.encodeInto(src.slice(start, limit), scratch);
  return { end: start + r.read, written: r.written };
}
function merge(src, blocks, join6, cap, lineCut) {
  const out = [];
  const scratch = new Uint8Array(cap);
  let cur;
  let curBytes = 0;
  const emit = (start, end, bytes) => {
    out.push({ ord: out.length, text: src.slice(start, end), bytes });
  };
  for (const b of blocks) {
    if (cur !== void 0 && !join6) {
      emit(cur.start, cur.end, curBytes);
      cur = void 0;
    }
    if (cur !== void 0) {
      const add = utf8Bytes(src.slice(cur.end, b.end));
      if (curBytes + add <= cap) {
        cur.end = b.end;
        curBytes += add;
        continue;
      }
      emit(cur.start, cur.end, curBytes);
      cur = void 0;
    }
    let start = b.start;
    let bytes = utf8Bytes(src.slice(b.start, b.end));
    while (bytes > cap) {
      const cut = cutPoint(src, start, b.end, scratch);
      const nl = lineCut ? src.lastIndexOf("\n", cut.end - 1) : -1;
      if (nl > start) {
        const w = utf8Bytes(src.slice(start, nl + 1));
        emit(start, nl + 1, w);
        start = nl + 1;
        bytes -= w;
        continue;
      }
      emit(start, cut.end, cut.written);
      start = cut.end;
      bytes -= cut.written;
    }
    cur = { start, end: b.end };
    curBytes = bytes;
  }
  if (cur !== void 0) emit(cur.start, cur.end, curBytes);
  return out;
}

// src/core/index/select.ts
var SEP = "\n";
var SEP_BYTES = 1;
function selectChunksInMemory(chunks, intent, budget, source, rankQuery) {
  return select(chunks, intent, budget, source, rankQuery);
}
function select(chunks, intent, budget, label, rankQuery) {
  if (chunks.length === 0) return { text: "", more: null };
  const texts = chunks.map((c) => c.text);
  const scores = rankQuery === void 0 ? rankTexts(texts, intent) : rankTexts(texts, rankQuery, "any");
  const order = chunks.map((_, i) => i).sort((a, b) => scores[b] - scores[a] || chunks[b].ord - chunks[a].ord);
  const picked = [];
  let used = 0;
  let skipped = false;
  for (const i of order) {
    const cost = chunks[i].bytes + (picked.length > 0 ? SEP_BYTES : 0);
    if (used + cost > budget) {
      skipped = true;
      continue;
    }
    picked.push(chunks[i]);
    used += cost;
  }
  picked.sort((a, b) => a.ord - b.ord);
  const text = picked.map((c) => c.text).join(SEP);
  return { text, more: skipped ? moreLine2(intent, label) : null };
}
function moreLine2(intent, label) {
  const source = label === void 0 ? "" : ", source:" + JSON.stringify(label);
  return "ctx_search({queries:[" + JSON.stringify(intent) + "]" + source + "})";
}

// src/core/index/text.ts
function storeText(db, project, sessionId, sourceKind, label, text, kind, chunks = chunkText(text, kind)) {
  const sourceId = ftsInsert(db, {
    projectKey: project.projectKey,
    sessionId,
    worktree: project.worktree,
    agent: project.agent,
    kind: sourceKind,
    label,
    bytes: Buffer.byteLength(text, "utf8"),
    chunkCount: chunks.length,
    createdAt: Date.now()
  }, chunks);
  return { sourceId, chunks: chunks.length };
}
function indexText(db, ctx, sessionId, source, text, kind, chunks) {
  return storeText(db, ctx, sessionId, "content", source, text, kind, chunks);
}

// src/core/hooks/detached.ts
async function write(project, row) {
  try {
    const db = await openDb(project);
    appendEvent(db, row);
  } catch (err) {
    const message2 = err instanceof Error ? err.message : String(err);
    process.stderr.write("hooks: journal write failed: " + message2 + "\n");
  }
}
function appendDetached(project, sessionId, row) {
  void write(project, row);
}

// src/core/hooks/decision.ts
function isObject2(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function labelText(v) {
  if (typeof v === "string") return v;
  if (!Array.isArray(v)) return "";
  return v.filter((x) => typeof x === "string" && x !== "").join(DECISION_LABEL_JOIN);
}
function answerPairs(answers) {
  if (Array.isArray(answers)) {
    return answers.filter(isObject2).filter((a) => typeof a.question === "string").map((a) => [a.question, a.label]);
  }
  return isObject2(answers) ? Object.entries(answers) : [];
}
function answerDecisions(responseText) {
  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    return [];
  }
  if (!isObject2(parsed)) return [];
  const out = [];
  for (const [question, value] of answerPairs(parsed[DECISION_ANSWERS_KEY])) {
    const label = labelText(value);
    if (question === "" || label === "") continue;
    out.push({ key: question, body: "Q: " + question + " \u2192 A: " + label });
  }
  return out;
}
function askOptionLabels(toolInput) {
  const questions = toolInput.questions;
  if (!Array.isArray(questions)) return [];
  const out = [];
  for (const q of questions) {
    if (!isObject2(q) || !Array.isArray(q.options)) continue;
    for (const o of q.options) if (isObject2(o) && typeof o.label === "string" && o.label !== "") out.push(o.label);
  }
  return out;
}
function fold(s) {
  return s.trim().toLowerCase();
}
function optionEchoDecision(prompt, labels, refSeq) {
  const p = fold(prompt);
  if (p === "") return null;
  const label = labels.find((l) => fold(l) === p);
  if (label === void 0) return null;
  return { key: DECISION_OPTION_KEY, body: "A: " + label + "\nref: #" + refSeq };
}

// src/core/hooks/throttle.ts
function markerKey(sessionId, onceKey) {
  return "hint:" + sessionId + ":" + onceKey;
}
function takeOnce(db, key) {
  if (metaGet(db, key) !== null) return false;
  metaSet(db, key, "1");
  return true;
}
function takeEvery(db, key, everyN) {
  const stored = metaGet(db, key);
  const count = (stored === null ? 0 : Number.parseInt(stored, 10)) + 1;
  metaSet(db, key, String(count));
  return (count - 1) % everyN === 0;
}
function shouldHint(db, sessionId, onceKey, everyN) {
  if (sessionId === "") return false;
  const key = markerKey(sessionId, onceKey);
  const decide2 = (h) => everyN === void 0 ? takeOnce(h, key) : takeEvery(h, key, everyN);
  return db.raw.isTransaction ? decide2(db) : withWrite(db, decide2);
}

// src/core/hooks/io.ts
import { writeSync } from "node:fs";
async function readStdin() {
  const parts = [];
  for await (const c of process.stdin) parts.push(c);
  return Buffer.concat(parts).toString("utf8");
}
function writeOut(text) {
  const buf = Buffer.from(text, "utf8");
  let off = 0;
  try {
    while (off < buf.length) off += writeSync(1, buf, off, buf.length - off);
  } catch (err) {
    if (err.code !== "EAGAIN") throw err;
    process.stdout.write(buf.subarray(off));
  }
}

// src/core/hooks/dispatch.ts
var ALLOW2 = { kind: "allow" };
var EMPTY4 = { stdout: "", exitCode: 0 };
var DIGIT_0 = 48;
function isAgentId(s) {
  return AGENT_IDS.includes(s);
}
function message(err) {
  return err instanceof Error ? err.message : String(err);
}
function str2(v) {
  return typeof v === "string" ? v : "";
}
async function handleHook(agent, raw, env) {
  if (!isAgentId(agent)) {
    process.stderr.write("hooks: unknown agent " + JSON.stringify(agent) + "\n");
    return EMPTY4;
  }
  const row = getAdapter(agent);
  let ev;
  try {
    ev = row.decode(raw);
  } catch (err) {
    process.stderr.write("hooks: decode failed: " + message(err) + "\n");
    return row.encode({ event: "PreToolUse", agent, sessionId: "", cwd: "", turn: 0 }, ALLOW2);
  }
  let project;
  try {
    project = resolveProject(agent, { env, argv: process.argv, cwd: ev.cwd });
  } catch (err) {
    process.stderr.write("hooks: no project: " + String(err.code ?? "ERROR") + " " + message(err) + "\n");
    return row.encode(ev, ALLOW2);
  }
  let decision;
  try {
    decision = await dispatch(ev, row, project, env);
  } catch (err) {
    process.stderr.write("hooks: " + message(err) + "\n");
    decision = ALLOW2;
  }
  return row.encode(ev, decision);
}
function dispatch(ev, row, project, env) {
  switch (ev.event) {
    case "SessionStart":
      return sessionStart(ev, row, project);
    case "UserPromptSubmit":
      return userPromptSubmit(ev, row, project);
    case "PreToolUse":
      return preToolUse(ev, row, project, env);
    case "PostToolUse":
      return postToolUse(ev, row, project, env);
    case "PreCompact":
      return preCompact(ev, row, project);
    case "Usage":
      return usage(ev, project);
  }
  return Promise.resolve(ALLOW2);
}
function withPrefix(template, row) {
  return template.split(TOOL_PREFIX_SLOT).join(row.toolNamePrefix);
}
function compactText(db, ev, row) {
  if (row.compactSummary === "host") return COMPACT_POINTER_LINE;
  return renderState(readSessionEvents(db, ev.sessionId), ev.turn ?? 0);
}
async function sessionStart(ev, row, project) {
  if (ev.source === "compact" && hasRecall(row)) markCompacted(await openDb(project), ev.sessionId);
  if (ev.source === "compact" && row.compactDelivery === "sessionstart") {
    const db2 = await openDb(project);
    if (!shouldHint(db2, ev.sessionId, COMPACT_STATE_KEY)) return ALLOW2;
    return { kind: "hint", text: compactText(db2, ev, row), onceKey: COMPACT_STATE_KEY };
  }
  const db = await openDb(project);
  if (row.compactDelivery === "opencode-cache" && metaTake(db, PENDING_COMPACT_META_PREFIX + ev.sessionId) !== null) {
    return { kind: "hint", text: compactText(db, ev, row), onceKey: PENDING_COMPACT_KEY };
  }
  if (!shouldHint(db, ev.sessionId, RESUME_HINT_KEY)) return ALLOW2;
  return { kind: "hint", text: withPrefix(RESUME_HINT, row), onceKey: RESUME_HINT_KEY };
}
async function userPromptSubmit(ev, row, project) {
  const body = ev.prompt ?? "";
  appendDetached(project, ev.sessionId, {
    session_id: ev.sessionId,
    worktree: project.worktree,
    agent: ev.agent,
    kind: "prompt",
    tool: null,
    key: null,
    path: null,
    ok: 1,
    exit_code: null,
    bytes: Buffer.byteLength(body),
    body,
    turn: ev.turn ?? 0,
    sandbox_bytes: 0,
    returned_bytes: 0
  });
  echoDetached(ev, project, body);
  if (row.compactDelivery === "pending-flag") {
    const db = await openDb(project);
    if (metaTake(db, PENDING_COMPACT_META_PREFIX + ev.sessionId) !== null) {
      return { kind: "hint", text: compactText(db, ev, row), onceKey: PENDING_COMPACT_KEY };
    }
  }
  return recall(ev, row, project, body);
}
function markCompacted(db, sessionId) {
  if (sessionId !== "") metaSet(db, COMPACTED_META_PREFIX + sessionId, PENDING_COMPACT_FLAG);
}
function seenSeqs(value) {
  if (value === null) return [];
  try {
    const v = JSON.parse(value);
    return Array.isArray(v) ? v.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}
async function recall(ev, row, project, prompt) {
  if (!hasRecall(row) || ev.sessionId === "") return ALLOW2;
  const db = await openDb(project);
  if (metaGet(db, COMPACTED_META_PREFIX + ev.sessionId) === null) return ALLOW2;
  const seenKey = RECALL_SEEN_META_PREFIX + ev.sessionId;
  const seen = seenSeqs(metaGet(db, seenKey));
  const picked = pickRecall(readRecallRows(db, ev.sessionId, project.worktree, RECALL_MAX_ROWS), prompt, new Set(seen));
  if (picked.text === "") return ALLOW2;
  metaSet(db, seenKey, JSON.stringify([...seen, ...picked.seqs]));
  return { kind: "hint", text: picked.text, onceKey: RECALL_KEY };
}
function optionsKey(sessionId) {
  return DECISION_SOURCE + ":" + DECISION_OPTION_KEY + ":" + sessionId;
}
function readOptions(value) {
  try {
    const v = JSON.parse(value);
    if (typeof v !== "object" || v === null) return null;
    const { seq, labels } = v;
    if (typeof seq !== "number" || !Array.isArray(labels)) return null;
    return { seq, labels: labels.filter((l) => typeof l === "string") };
  } catch {
    return null;
  }
}
function echoDetached(ev, project, prompt) {
  if (ev.sessionId === "") return;
  const key = optionsKey(ev.sessionId);
  void openDb(project).then((db) => {
    if (metaGet(db, key) === null) return;
    const taken = metaTake(db, key);
    const offered = taken === null ? null : readOptions(taken);
    if (offered === null) return;
    const part = optionEchoDecision(prompt, offered.labels, offered.seq);
    if (part !== null) writeDecisions(db, ev, project, [part]);
  }).catch((err) => {
    process.stderr.write("hooks: decision write failed: " + message(err) + "\n");
  });
}
function writeDecisions(db, ev, project, parts) {
  for (const part of parts) {
    appendEvent(db, {
      session_id: ev.sessionId,
      worktree: project.worktree,
      agent: ev.agent,
      kind: "decision",
      tool: DECISION_TOOL,
      key: part.key,
      path: null,
      ok: 1,
      exit_code: null,
      bytes: Buffer.byteLength(part.body),
      body: part.body,
      turn: ev.turn ?? 0,
      sandbox_bytes: 0,
      returned_bytes: 0
    });
    indexText(db, project, ev.sessionId, DECISION_SOURCE, part.body, "text");
  }
}
function askDetached(ev, project, tool, text) {
  const parts = answerDecisions(text);
  const labels = parts.length === 0 ? askOptionLabels(tool.input) : [];
  if (parts.length === 0 && labels.length === 0) return;
  void openDb(project).then((db) => {
    if (parts.length > 0) return writeDecisions(db, ev, project, parts);
    const prompts = readSessionEvents(db, ev.sessionId, "prompt");
    const last = prompts[prompts.length - 1];
    if (last === void 0 || ev.sessionId === "") return;
    metaSet(db, optionsKey(ev.sessionId), JSON.stringify({ seq: last.seq, labels }));
  }).catch((err) => {
    process.stderr.write("hooks: decision write failed: " + message(err) + "\n");
  });
}
async function preToolUse(ev, row, project, env) {
  const userDeny = readUserDeny(project.worktree, ev.agent);
  const decision0 = decide(ev, row, userDeny);
  let decision = decision0;
  if (decision0.kind === "deny" && isSubagentCall(ev)) {
    const subCase = pickSubagentCase(ev, toolSetForAgentType(ev, { projectDir: project.worktree, env }));
    if (subCase === "B") decision = caseB(ev, row, decision0, userDeny);
  }
  return decision;
}
function isShell(tool, row) {
  return tool.canonicalName === SHELL_TOOL || row.nativeTools.shell.includes(tool.name);
}
function isUserPolicyDeny(reason) {
  return reason.startsWith(USER_DENY_REASON_PREFIX) || reason === POLICY_UNREADABLE_LINE || reason === PARSE_ERROR_DENY_LINE;
}
function b64(s) {
  return Buffer.from(s, "utf8").toString("base64url");
}
function caseB(ev, row, d0, userDeny) {
  const tool = ev.tool;
  if (tool === void 0 || !isShell(tool, row) || isUserPolicyDeny(d0.reason)) return d0;
  const command = tool.input.command;
  if (typeof command !== "string") return d0;
  const wrapper = '"' + join5(dirname3(process.argv[1] ?? ""), RUN_WRAPPER_FILE) + '"';
  const rewritten = [RUN_WRAPPER_NODE, wrapper, b64(command), b64(JSON.stringify(userDeny ?? [])), b64(str2(tool.input.description))].join(" ");
  return { kind: "deny", reason: SUBAGENT_RUN_DENY, rewritten };
}
function journalKind(tool, row, isError) {
  if (isError) return "toolerr";
  if (EDIT_TOOLS.includes(tool.canonicalName) || (row.nativeTools.edit ?? []).includes(tool.name)) return "edit";
  if (isShell(tool, row)) return "cmd";
  return null;
}
function stableJson(v) {
  if (Array.isArray(v)) return "[" + v.map(stableJson).join(",") + "]";
  if (typeof v === "object" && v !== null) {
    const o = v;
    const keys = Object.keys(o).filter((k) => o[k] !== void 0).sort();
    return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableJson(o[k])).join(",") + "}";
  }
  return JSON.stringify(v) ?? "null";
}
function exitCodeOf(text) {
  const nl = text.indexOf("\n");
  const first = nl < 0 ? text : text.slice(0, nl);
  if (!first.startsWith(EXIT_CODE_LINE_PREFIX)) return null;
  let n = 0;
  let digits = 0;
  for (const ch of first.slice(EXIT_CODE_LINE_PREFIX.length)) {
    const d = ch.charCodeAt(0) - DIGIT_0;
    if (d < 0 || d > 9) break;
    n = n * 10 + d;
    digits++;
  }
  return digits === 0 ? null : n;
}
function pathOf(input) {
  for (const k of EDIT_PATH_KEYS) if (typeof input[k] === "string") return input[k];
  return null;
}
async function postToolUse(ev, row, project, env) {
  const tool = ev.tool;
  if (tool === void 0 || tool.canonicalName.startsWith(OWN_TOOL_PREFIX)) return ALLOW2;
  const result = ev.result ?? { isError: false, bytes: 0 };
  const text = result.text ?? "";
  if (tool.canonicalName === DECISION_TOOL) askDetached(ev, project, tool, text);
  const kind = journalKind(tool, row, result.isError);
  if (kind !== null) {
    const key = kind === "cmd" ? canonicalKey(tool.canonicalName, str2(tool.input.command)) : kind === "toolerr" ? tool.canonicalName + ":" + stableJson(tool.input) : null;
    appendDetached(project, ev.sessionId, {
      // step 4; body is the whole text (D-M3-H2-6)
      session_id: ev.sessionId,
      worktree: project.worktree,
      agent: ev.agent,
      kind,
      tool: tool.canonicalName,
      key,
      path: pathOf(tool.input),
      ok: result.isError ? 0 : 1,
      exit_code: exitCodeOf(text),
      bytes: result.bytes,
      body: text,
      turn: ev.turn ?? 0,
      sandbox_bytes: result.bytes,
      returned_bytes: result.bytes
    });
  }
  if (result.bytes <= REPLACE_TRIGGER_BYTES) return ALLOW2;
  let label;
  if (isSubagentCall(ev)) {
    const subCase = pickSubagentCase(ev, toolSetForAgentType(ev, { projectDir: project.worktree, env }));
    if (subCase === "A") return ALLOW2;
    label = SUBAGENT_SOURCE_PREFIX + tool.canonicalName + ":" + String(ev.turn ?? 0);
  } else {
    if (!hasReplace(row)) return ALLOW2;
    label = mainLabel(tool, ev);
  }
  const intent = [tool.input.description, tool.input.command, tool.input.file_path, tool.input.pattern, tool.input.url].map(str2).find((v) => v.trim() !== "") ?? "";
  const chunks = chunkText(text, "text", REPLACE_CHUNK_BYTES);
  if (result.bytes <= SYNC_INDEX_MAX_BYTES) {
    const db = await openDb(project);
    indexText(db, project, ev.sessionId, label, text, "text", chunks);
  } else {
    indexDetached(project, ev.sessionId, label, text, chunks);
  }
  const prompt = await lastPrompt(project, ev.sessionId);
  const rankQuery = prompt.trim() === "" ? void 0 : intent + " " + prompt;
  const selected = selectChunksInMemory(chunks, intent, REPLACE_RETURN_BYTES, label, rankQuery);
  return { kind: "replace", output: selected.text + (selected.more !== null ? "\n" + selected.more : "") };
}
async function lastPrompt(project, sessionId) {
  try {
    return readLastPrompt(await openDb(project), sessionId);
  } catch {
    return "";
  }
}
function mainLabel(tool, ev) {
  const cmd = str2(tool.input.command) ?? str2(tool.input.file_path) ?? "";
  const nl = cmd.indexOf("\n");
  const head = (tool.canonicalName + ":" + (nl < 0 ? cmd : cmd.slice(0, nl))).slice(0, SOURCE_LABEL_MAX_CHARS);
  return head + "#" + (tool.callId ?? String(ev.turn ?? 0));
}
function indexDetached(project, sessionId, label, text, chunks) {
  void openDb(project).then((db) => {
    indexText(db, project, sessionId, label, text, "text", chunks);
  }).catch((err) => {
    process.stderr.write("hooks: index write failed: " + message(err) + "\n");
  });
}
async function preCompact(ev, row, project) {
  const db = await openDb(project);
  metaSet(db, PENDING_COMPACT_META_PREFIX + ev.sessionId, PENDING_COMPACT_FLAG);
  if (hasRecall(row)) markCompacted(db, ev.sessionId);
  return ALLOW2;
}
function usage(ev, project) {
  appendDetached(project, ev.sessionId, {
    session_id: ev.sessionId,
    worktree: project.worktree,
    agent: ev.agent,
    kind: "cost",
    tool: null,
    key: null,
    path: null,
    ok: 1,
    exit_code: null,
    bytes: 0,
    body: "",
    turn: ev.turn ?? 0,
    sandbox_bytes: 0,
    returned_bytes: 0
  });
  return Promise.resolve(ALLOW2);
}

// src/entries/hook.ts
var EMPTY5 = { stdout: "", exitCode: 0 };
function isAgentId2(s) {
  return AGENT_IDS.includes(s);
}
function finish(out) {
  process.exitCode = out.exitCode;
  if (out.stdout !== "") writeOut(out.stdout);
}
async function main(argv, env) {
  const i = argv.indexOf(AGENT_ARG);
  const agent = i >= 0 ? argv[i + 1] ?? "" : "";
  if (!isAgentId2(agent)) {
    console.error("hooks: unknown " + AGENT_ARG + " " + JSON.stringify(agent) + ". Fix: pass " + AGENT_ARG + " with one of " + AGENT_IDS.join(", ") + ".");
    return finish(EMPTY5);
  }
  let raw;
  try {
    raw = JSON.parse(await readStdin());
  } catch (err) {
    console.error("hooks: " + err.message);
    return finish(EMPTY5);
  }
  try {
    return finish(await handleHook(agent, raw, env));
  } catch (err) {
    console.error("hooks: " + err.message);
    return finish(EMPTY5);
  }
}
void main(process.argv.slice(2), process.env);
export {
  main
};
