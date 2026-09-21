# OpenEntity Channels RFC Index

OpenEntity Channels (OEC) is the internal delivery layer for OpenIntent. It exposes entity capabilities to trusted agents and runtime components, while humans and external clients interact through intents, not directly through entities.

The OpenIntent repository is intentionally transport-neutral: HTTP, QUIC, NATS, Kafka and OpenEntityChannels adapters may carry intent documents without changing their meaning. OEC extends that model with internal entity-channel delivery contracts.

## RFC set

| RFC | Title | Type | Status |
| --- | --- | --- | --- |
| RFC-OEC-0000 | OpenEntity Channels Overview | Semantic | Draft |
| RFC-OEC-0001 | Intent-to-Entity Boundary | Semantic | Draft |
| RFC-OEC-0002 | Entity Channel Contract | Semantic | Draft |
| RFC-OEC-0003 | Internal Transport Bindings | Semantic | Draft |
| RFC-OEC-0004 | Addressing, Headers and Route Hashing | Semantic | Draft |
| RFC-OEC-0005 | OpenAPI and x-oec Extensions | Implementation | Draft |
| RFC-OEC-0006 | Generated Conformance Tests | Implementation | Draft |
| RFC-OEC-0007 | Orchestrator Routing Contract | Implementation | Draft |

## Canonical layering

```text
Human / WhatsApp / UI
  -> OpenIntent document
  -> Orchestrator
  -> Intent resolution
  -> Capability selection
  -> OpenEntity Channels internal delivery
  -> Entity behavior execution
  -> audit / observability / result
```

OEC MUST NOT be treated as a public API surface by default. REST, WebSocket, gRPC, MCP and STDIO bindings exist for internal agents, tools, conformance tests and service adapters.

## RFC file pattern

Each RFC follows this structure:

```text
Status
Category
Version
Depends-On
Purpose
Terminology
Normative Requirements
Invariants
Examples
Conformance Tests
Implementation Notes
Open Questions
```
