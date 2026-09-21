# RFC-OEC-0003: Internal Transport Bindings

## Status

Implemented reference profile.

## Category

Semantic.

## Version

0.1.0.

## Depends-On

RFC-OEC-0000, RFC-OEC-0001 and RFC-OEC-0002.

## Purpose

This RFC defines how OEC maps entity behavior delivery to internal transport bindings. REST, WebSocket, gRPC, MCP and STDIO/local bindings are implementation choices. They do not change the intent or entity behavior semantics.

## Terminology

- REST binding: HTTP request/response binding, useful for tooling and external adapters.
- WebSocket binding: persistent bidirectional channel, useful for realtime sessions and UI/agent streams.
- gRPC binding: binary RPC binding, useful for service-to-service internal calls.
- MCP binding: tool-oriented binding, useful for agent/tool discovery and invocation.
- STDIO binding: child-process tool binding, useful for local tools, sandboxes and MCP-style subprocesses.
- Local binding: same-process function call, actor mailbox or in-memory bus.

## Normative Requirements

1. A binding MUST preserve the selected entity, behavior, body kind and correlation metadata.
2. Bindings MUST NOT weaken authorization or replay protection.
3. Bindings SHOULD support route hash verification when crossing a trust boundary.
4. gRPC SHOULD be preferred for high-throughput service-to-service RPC when both ends are services.
5. WebSocket SHOULD be preferred for long-lived bidirectional streams and browser-compatible realtime delivery.
6. STDIO SHOULD be preferred only for subprocess tools, sandboxed workers or local MCP-like integrations.
7. Local in-process calls SHOULD be preferred for same-process orchestration when no isolation boundary is required.
8. REST SHOULD remain available for compatibility, diagnostics, generated documentation and adapters.

## Invariants

- Hashing is not a transport.
- A route hash validates addressing and integrity inputs; it does not carry bytes by itself.
- The fastest safe binding is the one with the fewest required boundaries.
- Crossing a process, container or network boundary is an architectural decision, not just a latency decision.

## Examples

```text
same process:       orchestrator -> actor mailbox -> behavior
same server:        orchestrator -> gRPC over loopback or Unix domain socket -> service
subprocess tool:    orchestrator -> STDIO -> tool runtime
browser realtime:   orchestrator -> WebSocket/SSE -> UI
agent tool call:    orchestrator -> MCP -> tool provider
```

## Conformance Tests

A conformant binding test SHOULD verify that:

- required headers or metadata are enforced;
- disabled channels reject delivery;
- body kinds are identical across equivalent bindings;
- stream bindings require stream-compatible accept or subscription metadata;
- route hash input is stable across supported transports.

## Implementation Notes

For the current orchestrator, use local function/actor delivery when the entity behavior runs in the same process. Use gRPC for internal service-to-service calls. Use WebSocket for realtime agent/UI sessions. Use STDIO for isolated local tools. Use REST primarily for generated docs, development and interoperability.

## Open Questions

- Whether `local` and `stdio` should be formal OEC channel names in v0.2.
- Whether gRPC over Unix domain sockets should be the default same-host multi-process profile.


## Executable reference profile

`selectOecBinding` implements deterministic preferences: local for same-process delivery, gRPC for service RPC, WebSocket for realtime, MCP for agent tools and STDIO for subprocess tools.

Bindings carry the same entity, behavior, body kind, intent correlation and internal metadata. Selection does not grant authorization.

