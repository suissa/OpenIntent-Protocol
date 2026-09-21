# RFC-OEC-0005: OpenAPI and x-oec Extensions

## Status

Draft.

## Category

Implementation.

## Version

0.1.0.

## Depends-On

RFC-OEC-0002, RFC-OEC-0003 and RFC-OEC-0004.

## Purpose

This RFC defines the generated documentation contract for OEC. OpenAPI 3.1 documents REST paths natively. Non-REST internal channels are represented through `x-oec-*` extensions so that one generated artifact can describe the full entity communication surface.

## Terminology

- OpenAPI paths: canonical REST endpoint documentation.
- x-oec-channels: extension array describing REST, WebSocket, gRPC, MCP and future local bindings.
- x-oec-body-kind: extension carrying OEC body kind.
- x-oec-behavior: extension carrying behavior reference.
- x-oec-stream: extension carrying stream mode such as `sse` or `ndjson`.

## Normative Requirements

1. The generator MUST emit valid OpenAPI 3.1 JSON.
2. REST routes MUST be emitted under `paths`.
3. REST path parameters declared as `:name` MUST be emitted as `{name}` in OpenAPI paths.
4. Multiple REST methods for the same path MUST be grouped under the same path item.
5. Routes with body kind `none` MUST NOT emit `requestBody`.
6. Routes with missing body and stream enabled MUST be treated as `none` unless explicitly declared otherwise.
7. WebSocket, gRPC and MCP channels MUST be represented in `x-oec-channels`.
8. Generated documentation MUST NOT expose secret values.
9. Generated documentation SHOULD preserve behavior references and route names for orchestrator diagnostics.

## Invariants

- OpenAPI is documentation and tooling surface, not the authority source.
- The OEC YAML remains the canonical input.
- x-oec extensions must preserve channel information that OpenAPI cannot natively represent.

## Examples

```json
{
  "openapi": "3.1.0",
  "x-oec-channels": [
    { "channel": "grpc", "service": "UserEntityChannelService" },
    { "channel": "mcp", "name": "user.entity.channel", "visibility": "internal" }
  ]
}
```

## Conformance Tests

The generator tests SHOULD validate:

- JSON validity;
- grouped methods for shared paths;
- conversion of `:id` to `{id}`;
- omission of request body for no-body routes;
- presence of `x-oec-channels` for non-REST bindings;
- presence of stream response content type for SSE routes.

## Implementation Notes

The current Zig generator should treat `observe` routes as no-body stream routes when only `stream: sse` is declared. It should avoid defaulting such routes to `payloadEnvelope` in `x-oec-body-kind`.

## Open Questions

- Whether AsyncAPI should also be generated for WebSocket and event streams.
- Whether gRPC descriptors should be generated from the same OEC declaration.
