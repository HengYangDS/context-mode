// D-DU-DENY-1: the Read (or one-file shell dump) deny over OUTPUT_CAP, impl/08 §6.1 step 6.
// One line from src/prompt/hooks/read-deny.md (inlined by build/build.mjs, lint-covered by docs/v2/prompt/lint.mjs):
// the exact ctx_execute call for this file. A ranged Read stays allowed (decide.ts); the text no longer lists it.
import { READ_DENY_TEMPLATE } from "../../prompt/_generated.ts";

export { READ_DENY_TEMPLATE };
const SIZE = "{size}";
const PATH = "{path}";

/** Size first, path last: the path is never re-scanned for a placeholder. */
export function READ_DENY_MESSAGE(path: string, size: number | string): string {
  return READ_DENY_TEMPLATE.split(SIZE).join(String(size)).split(PATH).join(path);
}
