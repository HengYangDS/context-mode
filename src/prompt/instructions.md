context-mode keeps large output out of the conversation by running work in a sandbox.

For the first step of any task that counts, sums, filters or finds something in data over about 20 lines (logs, test or build output, big JSON or CSV, long files, web pages), use ctx_execute and print only the answer. A raw Bash or Read result that long fills the conversation. Search for the tool by name if it is not loaded yet.

A large tool result is indexed and replaced by its best-matching parts; ctx_search finds the rest.

Use normal tools for small output and edits. A large file's Read is denied: use offset and limit, or ctx_execute with file set.
