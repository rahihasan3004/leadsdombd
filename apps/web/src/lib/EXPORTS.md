# Lead exports

Authenticated endpoint: `GET /api/exports/stream`.

- `purchaseId`: export only this user's COMPLETED order. Without it, completed per-lead unlocks are still scoped to the signed-in user.
- `state=TX`, `states=TX,GA`, repeated `state` parameters, or `state=ALL` / `All States` / `all_states` are supported. An owned `purchaseId` without a state selector exports that entire order. ALL removes only the state filter, never the user, order, or completed-status filters.
- `format=csv|json` (default CSV).
- `grouping=combined|split` (default combined). Split produces one ZIP with files such as `Texas.csv`, `Georgia.csv`, or their JSON equivalents. Unknown/null states are preserved in `Unknown-State` rather than silently dropped. ZIP is the container; the existing export record's format is CSV/JSON, with ZIP/grouping recorded in searchQuery. No schema migration is needed.

## Failure-safe preparation and streaming

The old Vault launched one browser request per state, and the old route only accepted two-character state codes. Its ReadableStream queried the database after response headers, and any query or final audit update failure called controller.error, aborting an in-progress attachment.

The new route first prepares the artifact in private temporary files, querying at most 1,000 unlocks per page with cursor pagination, bounded transient retries, and per-row server-side tier redaction. CSV/JSON rows are written in per-state batches rather than retaining the full export in memory. Split files are packaged by archiver with streaming backpressure. File preparation, serialization, ZIP construction, and opening the completed download file all happen BEFORE attachment headers are returned. Failed preparation returns a safe JSON HTTP error, not a partial file. Audit completion update failures cannot abort a valid artifact.

The response then streams the completed file with correct Content-Type, Content-Disposition, Content-Length, private/no-store caching, and nosniff headers. Stream close/cancellation removes temporary files. Export COMPLETED means the artifact was prepared; it is not proof the browser received every byte. Network interruption, filesystem faults, process termination or platform duration limits can still interrupt transport; no implementation can make those impossible.

Limits: 100,000 rows, 128 MiB artifact/source data cap, 95-second preparation budget; the Node route requests a 300-second platform duration. Ensure the deployment plan supports that duration and temporary-file storage. Larger jobs should use a durable asynchronous export worker/object storage rather than extending a request indefinitely. An interrupted process can leave ephemeral temporary files until instance cleanup; do not treat /tmp as durable export storage.

## Tier and CSV safety

Every row uses its associated purchase tier, never a query-supplied tier. PHONE_ONLY exports have an empty/null email; full packs include only a currently validated/deliverable email. JSON uses a fixed allowlist, not raw Agent objects or nested metadata containing duplicate email addresses. PHONE_ONLY also strips plain and percent-encoded email strings embedded in allowed text/URL fields. CSV string cells neutralize formula prefixes; the spreadsheet-friendly phone formula is constructed only from a strictly numeric ten-digit phone.

## Vault experience

Single-state orders download CSV directly, with a compact JSON format dropdown. Multi-state/All States orders open a keyboard-accessible, focus-trapped dialog with CSV/JSON and combined/split choices. Both desktop and mobile views use the same control. Pending/refunded orders remain disabled. One request downloads one attachment, including ZIP; error responses and partial blobs are not saved as stream.txt. Compressed HTTP downloads are handled without comparing compressed wire length to decoded blob size. Preparing states, cancellation, and clear retry errors are shown in the UI.

Regression tests validate real CSV, JSON arrays and ZIP central-directory contents, phone-only redaction inside both ZIP formats, bounded paging, pre-header query failures, audit failures, option parsing, permission checks, one-request downloads and client error handling. They do not export production customer data.
