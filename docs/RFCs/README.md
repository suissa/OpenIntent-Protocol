# OpenEntity Channels RFC Index

OpenEntity Channels (OEC) is the internal delivery layer for OpenIntent. It exposes entity capabilities to trusted agents and runtime components, while humans and external clients interact through intents, not directly through entities.

The OpenIntent repository is intentionally transport-neutral: HTTP, QUIC, NATS, Kafka and OpenEntityChannels adapters may carry intent documents without changing their meaning. OEC extends that model with internal entity-channel delivery contracts.

## RFC set

| RFC | Title | Type | Status |
| --- | --- | --- | --- |
| RFC-OEC-0000 | OpenEntity Channels Overview | Semantic | Implemented reference profile |
| RFC-OEC-0001 | Intent-to-Entity Boundary | Semantic | Implemented reference profile |
| RFC-OEC-0002 | Entity Channel Contract | Semantic | Implemented reference profile |
| RFC-OEC-0003 | Internal Transport Bindings | Semantic | Implemented reference profile |
| RFC-OEC-0004 | Addressing, Headers and Route Hashing | Semantic | Implemented reference profile |
| RFC-OEC-0005 | OpenAPI and x-oec Extensions | Implementation | Implemented reference profile |
| RFC-OEC-0006 | Generated Conformance Tests | Implementation | Implemented reference profile |
| RFC-OEC-0007 | Orchestrator Routing Contract | Implementation | Implemented reference profile |

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

The executable conformance mapping is defined in `OEC-CONFORMANCE-MATRIX.md`. The canonical declaration is `examples/oec-user.json`; generated artifacts are produced with `npm run generate:oec`.

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


## Executable profile

The repository now provides the TypeScript reference implementation, JSON Schemas, generated OpenAPI and generated conformance manifest described by the RFC set. OEC artifacts are internal and are never the public OpenIntent API.
