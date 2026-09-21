# RFC-OEC-0002: Entity Channel Contract

## Status

Draft.

## Category

Semantic.

## Version

0.1.0.

## Depends-On

RFC-OEC-0000 and RFC-OEC-0001.

## Purpose

This RFC defines the canonical declaration for an entity channel. The declaration is the source for generated tests, OpenAPI extensions, runtime validation and orchestrator routing metadata.

## Terminology

- Entity declaration: `entities.<EntityName>` block.
- Channel declaration: `entities.<EntityName>.channels.<channel>` block.
- Route declaration: REST-like operation declaration inside a channel.
- Behavior reference: canonical behavior identifier such as `User.auth.magicLink.request`.
- Body kind: `payloadEnvelope`, `entitySchema` or `none`.

## Normative Requirements

1. Each entity MUST declare its identity field.
2. Each entity SHOULD declare a canonical label for UI and operator-facing diagnostics.
3. Each channel MUST declare whether it is enabled.
4. Channel-specific properties MUST NOT change entity semantics.
5. Route-level required headers MUST override or narrow the defaults only when explicitly declared.
6. Missing `body` MUST be interpreted as `none`, not as the default body kind, for routes where a stream or no-body operation is declared.
7. Behavior references MUST be stable and canonical.
8. The same behavior MAY be reachable through multiple channels.

## Invariants

- Entity identity is independent of transport.
- Body kind is part of the route contract.
- Stream routes are not request-body routes unless explicitly declared.
- A route without behavior is an entity operation contract, not an implicit behavior implementation.

## Examples

```yaml
entities:
  Paciente:
    schemaRef: ./entities/Paciente/Paciente.um
    idField: pacienteId
    canonicalLabel: nome
    channels:
      rest:
        enabled: true
        base: /pacientes
        routes:
          - name: get
            method: GET
            path: /:id
            body: none
```

## Conformance Tests

Generated tests MUST include:

- happy path per enabled channel;
- missing required header or metadata;
- invalid method for REST routes;
- invalid path or base;
- invalid body kind;
- invalid stream accept for SSE routes;
- invalid channel disabled state.

## Implementation Notes

The current generator should normalize missing route body to `none`. OpenAPI output should omit `requestBody` for `none` routes and should not emit `x-oec-body-kind: payloadEnvelope` for stream-only routes.

## Open Questions

- Whether route declarations should support explicit response schemas.
- Whether `behavior` should become mandatory for non-CRUD routes.
