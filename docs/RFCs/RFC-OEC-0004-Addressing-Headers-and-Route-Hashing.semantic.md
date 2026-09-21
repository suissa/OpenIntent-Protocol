# RFC-OEC-0004: Addressing, Headers and Route Hashing

## Status

Implemented reference profile.

## Category

Semantic.

## Version

0.1.0.

## Depends-On

RFC-OEC-0001, RFC-OEC-0002 and RFC-OEC-0003.

## Purpose

This RFC defines canonical addressing metadata for OEC delivery. Headers and metadata allow the orchestrator, agents and entity services to correlate, validate and audit internal delivery.

## Terminology

- Trace id: correlation identifier for execution and observability.
- Route hash: deterministic HMAC or digest binding route inputs.
- Agent id: identity of the calling internal agent or runtime component.
- Metadata: transport-neutral equivalent of headers.
- Secret reference: pointer to a secret, never the secret value.

## Normative Requirements

1. OEC declarations MUST support default required headers or metadata.
2. Channel or route declarations MAY narrow or override required metadata only explicitly.
3. Required metadata MUST be enforced for REST, WebSocket, gRPC, MCP and local bindings that cross a trust boundary.
4. Route hashing MUST use declared inputs in declared order.
5. Secret references MUST NOT be materialized into generated documentation.
6. Route hash verification MUST fail closed when the implementation cannot resolve the required secret.
7. Route hash verification MUST NOT be treated as user authorization.
8. Metadata names SHOULD remain stable across transports even when represented as HTTP headers, gRPC metadata or MCP fields.

## Invariants

- Trace metadata is required for observability, not for authorization.
- Agent identity is required for accountability, not for human delegation.
- HMAC validates route address integrity; policy validates permission.
- A secret reference is not a secret.

## Examples

```yaml
defaults:
  requiredHeaders:
    - X-OEC-Trace-Id
    - X-OEC-Route-Hash
    - X-OEC-Agent-Id
  hashing:
    algorithm: hmacSha256
    secretRef: vault://oec/route-hash-secret
    input:
      - apiKey
      - entityName
      - entityId
```

## Conformance Tests

Generated tests SHOULD cover:

- missing trace id;
- missing route hash;
- missing agent id;
- route-specific header override;
- invalid route hash;
- unavailable secret reference;
- stable hash input order.

## Implementation Notes

The first generator may validate the presence of headers without computing the HMAC. A stricter profile should add executable route-hash verification with a test secret provider.

## Open Questions

- Whether route hash should include behavior name and channel name by default.
- Whether nonce and timestamp should be mandatory for all cross-process calls.


## Executable reference profile

`computeOecRouteHash` uses HMAC-SHA256 over a length-delimited canonical sequence in the declared input order. `OecSecretProvider` resolves a `secretRef`; the secret value is never serialized into documentation or trace.

`verifyOecRouteHash` fails closed for missing secrets, unsupported algorithms, missing hashes and mismatches. A valid hash cannot turn a denied authority decision into an allowed delivery.

