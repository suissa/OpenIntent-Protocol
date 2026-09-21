# RFC-OEC-0000: OpenEntity Channels Overview

## Status

Implemented reference profile.

## Category

Semantic.

## Version

0.1.0.

## Depends-On

OpenIntent Protocol processing order, capability discovery, idempotent execution and audit semantics.

## Purpose

OpenEntity Channels defines how internal agents, runtimes and adapters deliver work to entity behaviors after an OpenIntent has been accepted. It is not a replacement for OpenIntent and it is not the public user-facing API. It is the internal multi-channel entity delivery contract.

A human or external system requests an intent. The orchestrator resolves the intent, checks authority, selects a capability, then uses OEC to reach the entity behavior that can fulfill it.

## Terminology

- Intent: user- or system-requested goal accepted by OpenIntent.
- Entity: domain object with identity, schema and behaviors.
- Behavior: executable capability bound to an entity.
- Channel: internal transport binding used to reach an entity behavior.
- Route: concrete channel operation.
- Orchestrator: runtime component that receives external requests and routes accepted intents.
- PayloadEnvelope: canonical request envelope used when a route expects structured input.
- EntitySchema: entity-shaped payload resolved from the entity schema reference.

## Normative Requirements

1. OEC MUST be transport-neutral at the semantic layer.
2. OEC MUST NOT allow external users to bypass OpenIntent authority checks.
3. OEC MUST expose entity behavior delivery to trusted internal agents, not to arbitrary users.
4. OEC MUST preserve the entity identity model across all channels.
5. OEC MUST allow multiple bindings for the same entity: REST, WebSocket, gRPC, MCP and local bindings.
6. OEC MUST preserve audit and observability metadata across channel boundaries.
7. OEC MUST support generated conformance tests from the same declaration used to generate documentation.

## Invariants

- An entity channel does not create authority by itself.
- Discovery is not authorization.
- Transport authentication is not an intent signature.
- Entity identity is stable even when the channel changes.
- The user sees intentions and results; agents may see entity channels.

## Examples

```yaml
protocol: EntityCommunicationProtocol
version: 0.1.0
entities:
  User:
    idField: id
    canonicalLabel: name
    channels:
      rest: { enabled: true }
      websocket: { enabled: true }
      grpc: { enabled: true }
      mcp: { enabled: true }
```

## Conformance Tests

An implementation is conformant when it can:

- parse an OEC declaration;
- resolve entities and channels;
- generate a channel contract;
- reject missing required headers or metadata;
- reject body kinds that do not match the route;
- execute generated happy-path and invalid-path tests.

## Implementation Notes

The executable reference profile uses TypeScript for declaration validation, test generation and OpenAPI generation. A future Zig port MUST preserve the same schemas, reason codes and trace events. OpenAPI is used for REST and `x-oec-*` extensions represent non-REST internal channels.

## Open Questions

- Whether local in-process delivery should be a first-class `local` channel or an optimization below the channel layer.
- Whether STDIO should be modeled as a channel binding or as an adapter runtime for tools.


## Executable reference profile

`src/oec.ts` preserves the processing boundary: an OEC delivery requires an accepted intent, an allowed authority decision and a trusted caller. The route hash is checked only after those predicates and is recorded as route integrity, never as authorization.

Observable events are emitted through `OecTrace` and carry `internal: true`.
