# OpenIntent Protocol 1.0 foundation

This document defines the executable foundation delivered by issues 1 through 8. It is intentionally transport-neutral: HTTP, QUIC, NATS, Kafka and OpenEntityChannels adapters may carry these documents, but they do not change their meaning.

## Processing order

An implementation MUST evaluate an intent in this order:

1. Parse and validate the document against the applicable JSON Schema.
2. Negotiate protocol, contract and required features.
3. Verify the signature and replay guard, when the contract requires signatures.
4. Validate delegation and Proof-of-Human-Return authority.
5. Resolve an advertised capability.
6. Create or resume an idempotent execution.
7. Emit audit records for each decision and transition.
8. Execute the selected capability and publish the terminal result.

Transport authentication is not a substitute for intent signatures. A valid signature is not a substitute for capability authorization. Delegation is not allowed to widen the requested capability, audience or execution scope.

## Versioning

Versions use MAJOR.MINOR.PATCH. Exact mode requires equality. Backward mode selects a provider version with the same major and an equal-or-newer minor version. Forward mode selects the same major with an equal-or-older minor version. Same-major mode only requires equal major versions.

A negotiation MUST fail with a stable reason code when no version or required feature matches. Required security and integrity features MUST NOT be silently dropped.

## Composition

A composed intent is a directed graph of nodes. Each node has an immutable intent and explicit dependencies. The graph MUST be acyclic and bounded. Parallel branches are represented by nodes with the same dependency set. Compensation is explicit through compensation_for; an implementation MUST NOT infer arbitrary inverse operations.

## Discovery

Capability advertisements include provider, version, schemas, channels, required features, priority and expiry. An expired or withdrawn advertisement is never selectable. Selection order is priority ascending, version descending and provider identifier ascending. Discovery is not authorization: the selected provider still has to pass policy and authority checks.

## Signatures

The reference profile uses Ed25519 over canonical JSON with lexicographically sorted object keys and no insignificant whitespace. The signature envelope carries key_id, signer, nonce, issued_at, expires_at and payload_hash. Implementations MUST reject mutation, unsupported algorithms and expired or not-yet-valid signatures. Replay protection is provided by a nonce store scoped to signer.

## Long-running execution

Execution identifiers are durable handles. The state machine is:

accepted -> running -> waiting -> running
accepted -> cancelled | expired
running -> succeeded | failed | cancelled | expired
waiting -> succeeded | failed | cancelled | expired

Every state mutation increments sequence. Submission is idempotent by idempotency_key. Progress is an integer from 0 to 100. Waiting is the interoperable state for human or external continuation.

## Audit

Audit records are append-only and hash-chained from GENESIS. Each record contains observed_at, actor, intent_id, event_type, sequence and data. Consumers MAY map the identifiers to CloudEvents and OpenTelemetry, but the OIP audit semantics remain independent of either vendor.

## H2A2H authority boundary

The authority envelope carries references and claims from OpenDelegation Protocol and Proof-of-Human-Return. It does not redefine those protocols. OIP checks audience, delegatee, expiry, revocation, capability scope and the required human-return binding to intent_id. The proof is required only when policy says so; when required, verified=true, matching intent and audience, and a non-expired proof are mandatory.

The authority check is separate from transport authentication, signature verification and execution acceptance. Its stable rejection codes are part of the observable contract.
