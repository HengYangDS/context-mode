# Spike r3-ledger: line units precomputed at PostToolUse

Status: started. Branch `exp/r3-ledger` from `v2-design` 5a79496d.

Defect: a 222 KB row is larger than `RECALL_BUDGET_BYTES`, so `pickRecall` skips the whole row and the
recall block after compaction is empty. a-ledger (572eaa46) ranked lines at prompt time (4-50 ms per prompt).

Plan: build line units (line + indent ancestors) once when the output is stored, index them as their own
FTS rows linked to the source row, and run one ranked query over them after compaction.
