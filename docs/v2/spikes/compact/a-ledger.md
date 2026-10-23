# compact-hard candidate a-ledger (salience-ranked session ledger)

Status: in progress. Branch `exp/compact-a-ledger` from `5e5da716`. Eval frozen at `32f57beb`.

Plan: keep a ledger of facts seen in replaced tool outputs, rank them with a fixed integer formula, and send
the top entries (exact value + a retrieval handle that works) in the SessionStart(compact) block.
