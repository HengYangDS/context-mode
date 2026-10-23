# Spike: v2 fixed per-session cost on short tasks

Status: in progress (open item 5).

Question: v2 costs more than direct on short tasks (v1-v2-gateway: +2.2% pooled; try-it: +16%).
Is a fixed per-session cost the cause, and can we cut it without losing routing?

Plan:
1. Measure the fixed cost: tokens of v2 init (instructions + tool schemas) from a transcript, per-turn cache read/write deltas vs direct.
2. Cut it: shorter descriptions that pass the prompt lint and routing e2e cases, instructions only what routing needs, no hook output below the replace threshold, no duplicate text.
3. A/B with start-cost-ab (--arms plain,v2), claude-opus-5-5, 3 cycles, before and after.
