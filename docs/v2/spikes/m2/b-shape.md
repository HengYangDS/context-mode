# M2 spike b-shape: shape by content type

Status: in progress on exp/m2-b-shape (base 69077b8a, frozen eval).

Plan: replace the generic BM25 chunk pick on shell output with a type-aware digest when a parser finds a
shape: JSON (JSON.parse, schema + rare-value rows) and line logs (Drain-style template mining, counts + exact
rare lines). No shape found -> the old BM25 path, unchanged. Every digest ends with the retrieval handle.
