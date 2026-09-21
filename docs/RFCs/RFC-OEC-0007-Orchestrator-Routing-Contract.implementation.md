# RFC-OEC-0007: Orchestrator Routing Contract

## Status

Draft.

## Category

Implementation.

## Version

0.1.0.

## Depends-On

RFC-OEC-0001, RFC-OEC-0002, RFC-OEC-0003 and RFC-OEC-0004.

## Purpose

This RFC defines how the orchestrator uses OEC after receiving an external webhook or UI event. The orchestrator does not expose entity channels to the user. It accepts an intent, selects an entity behavior and chooses an internal channel based on locality, latency, isolation, streaming needs and capability policy.

## Terminology

- Delivery plan: selected entity, behavior, channel and route metadata for an accepted intent.
- Locality: whether the target behavior is in-process, same host, same private network or remote.
- Isolation boundary: process, container, VM or network boundary crossed by the call.
- Routing policy: deterministic rules for selecting an internal channel.

## Normative Requirements

1. The orchestrator MUST receive external requests as intents or events, not as direct entity-channel calls.
2. The orchestrator MUST resolve the intent before choosing an entity behavior.
3. The orchestrator MUST choose the cheapest safe binding for the required isolation level.
4. The orchestrator SHOULD prefer in-process/local actor delivery when the behavior is inside the same runtime and no isolation boundary is required.
5. The orchestrator SHOULD prefer gRPC for internal service-to-service request/response calls.
6. The orchestrator SHOULD prefer WebSocket or SSE for realtime streaming to UI or long-lived agent sessions.
7. The orchestrator SHOULD prefer STDIO for child-process tools, sandboxes or tool runtimes that speak through standard streams.
8. The orchestrator MUST include trace, route hash and agent metadata when crossing an internal trust boundary.
9. The orchestrator MUST emit audit records for route selection and terminal result.

## Invariants

- The user has access to intentions, not entities.
- OEC is an internal routing fabric.
- The selected transport cannot widen the accepted intent.
- The delivery plan must be reconstructable from audit and observability metadata.

## Examples

```text
WhatsApp webhook
  -> classify intent: Consulta.Agendar
  -> accept execution
  -> select capability: Consulta.create
  -> resolve entity: Consulta
  -> select channel: local if in-process, otherwise gRPC
  -> deliver payloadEnvelope
  -> audit result
```

## Routing Preference Matrix

| Case | Preferred binding |
| --- | --- |
| Same process | local function / actor mailbox / in-memory bus |
| Same host, separate service | gRPC over loopback or Unix domain socket |
| Browser or operator realtime | WebSocket or SSE |
| Internal binary RPC | gRPC |
| Agent tool provider | MCP |
| Subprocess sandbox/tool | STDIO |
| Debugging and docs | REST |

## Conformance Tests

An implementation SHOULD test that:

- a webhook produces an accepted intent before OEC delivery;
- direct entity-channel execution fails without accepted intent context in production profile;
- routing policy selects local delivery for same-process behaviors;
- routing policy selects gRPC for same-host service behavior when local is unavailable;
- audit includes intent id, entity, behavior, channel and route hash.

## Implementation Notes

The current WhatsApp orchestrator can start with a simple routing table. Later, this can become a policy-driven selector using runtime health, locality, channel availability and behavior constraints.

## Open Questions

- Whether routing policy should be declared in the OEC YAML or in the orchestrator config.
- Whether route selection should be part of OpenIntent audit or OEC observability only.
