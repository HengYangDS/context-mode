# M2 candidate b-read: structure-aware Read view

Status: in progress.

Plan:
1. Tests first: Read PostToolUse replace on the claude-code row (Read output shape), small and ranged reads pass through.
2. Algorithm: outline + region view, full text indexed, exact line-range handle (Read offset/limit).
3. Live: Edit-after-Read task, then bench/m2/eval.mjs --set main and --set heldout, n=3.
