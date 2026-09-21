# RFC-OEC-0006: Generated Conformance Tests

## Status

Draft.

## Category

Implementation.

## Version

0.1.0.

## Depends-On

RFC-OEC-0002, RFC-OEC-0003, RFC-OEC-0004 and RFC-OEC-0005.

## Purpose

This RFC defines how OEC declarations produce executable tests. The goal is to make the channel contract testable instead of relying on documentation alone.

## Terminology

- Happy path: valid request accepted by the runtime validator.
- Invalid path: request that intentionally violates one contract rule.
- Behavior-state fixture: synthetic state used to test behavior-level validation.
- Conformance profile: set of tests required for a runtime or generator version.

## Normative Requirements

1. The test generator MUST read the same declaration used to generate documentation.
2. The generator MUST emit at least one happy-path test per enabled channel.
3. The generator MUST emit invalid tests for missing required metadata.
4. REST route tests MUST cover method mismatch, path mismatch and body-kind mismatch.
5. Stream route tests MUST cover invalid accept or subscription metadata.
6. Behavior-bound routes SHOULD generate behavior-specific invalid-state tests.
7. Tests MUST be deterministic and dependency-light.
8. Generated tests MUST NOT require real secrets, real network servers or live external services.

## Invariants

- Generated tests verify the contract, not production business data.
- Each invalid test should fail for exactly one primary reason.
- Conformance tests must be reproducible in CI.

## Examples

```zig
test "OEC User REST requestMagicLink invalid missing required header" {
    try std.testing.expectError(
        error.MissingRequiredHeader,
        oec.validateRest(defaults, route, request),
    );
}
```

## Conformance Tests

A conformant generator should emit tests for:

- REST happy path;
- REST missing header;
- REST invalid method;
- REST invalid path;
- REST invalid body kind;
- WebSocket invalid base;
- WebSocket missing headers;
- gRPC invalid service;
- gRPC missing metadata;
- MCP invalid name;
- MCP invalid visibility;
- disabled channel.

## Implementation Notes

The first implementation profile targets Zig 0.16. `std.ArrayList` usage should follow the allocator-less pattern and generated tests should import a small OEC validation module.

## Open Questions

- Whether generated tests should be golden-file based or property-based for larger schemas.
- Whether each behavior should generate its own fixture file.
