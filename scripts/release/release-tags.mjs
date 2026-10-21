// scripts/release/release-tags.mjs — which v2 releases are tagged on the remote (DEVIATIONS D-FU-RF-1).
// A "tagged release" is an annotated tag v<major>.<minor>.<patch> with major >= 2 that is pushed to the
// remote. A release or release-staging commit with no such tag is a rehearsal. v1 tags (v0.x, v1.x) and
// lightweight tags are not releases. Plain string ops, no regex (TECH-SPEC §11).
import { LS_REMOTE_FIELD_SEP } from "../../src/core/contracts/constants.ts";

const TAG_REF_PREFIX = "refs/tags/";
const PEELED_SUFFIX = "^{}";
const TAG_PREFIX = "v";
const FIRST_RELEASE_MAJOR = 2;

function parseVersion(name) {
  if (!name.startsWith(TAG_PREFIX)) return null;
  const parts = name.slice(TAG_PREFIX.length).split(".");
  if (parts.length !== 3) return null;
  if (!parts.every((p) => p.length > 0 && [...p].every((c) => c >= "0" && c <= "9"))) return null;
  const nums = parts.map(Number);
  return nums[0] >= FIRST_RELEASE_MAJOR ? nums : null;
}

// `git ls-remote --tags <remote>` output -> [{ tag, commit }] newest version first.
// An annotated tag has a second, peeled line "<commit>\trefs/tags/<tag>^{}"; a lightweight tag has none.
export function parseTaggedReleases(lsRemoteOutput) {
  const peeled = new Map();
  for (const line of lsRemoteOutput.split("\n")) {
    const [sha, ref] = line.split(LS_REMOTE_FIELD_SEP);
    if (!ref || !ref.startsWith(TAG_REF_PREFIX) || !ref.endsWith(PEELED_SUFFIX)) continue;
    peeled.set(ref.slice(TAG_REF_PREFIX.length, -PEELED_SUFFIX.length), sha);
  }
  const out = [];
  for (const [tag, commit] of peeled) {
    const version = parseVersion(tag);
    if (version) out.push({ tag, commit, version });
  }
  out.sort((a, b) => b.version[0] - a.version[0] || b.version[1] - a.version[1] || b.version[2] - a.version[2]);
  return out.map(({ tag, commit }) => ({ tag, commit }));
}
