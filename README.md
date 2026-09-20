# OpenIntent-Protocol

The OpenIntent Protocol (OIP) is a transport-neutral, declarative contract for interoperability between agents, services and human-facing systems. An implementation declares the intent and required capability; adapters materialize transport, serialization and delivery.

This repository now contains the executable foundation for the eight version-1.0 workstreams:

1. versioning and compatibility negotiation;
2. intent composition and acyclic chaining;
3. formal JSON Schema 2020-12 contracts;
4. distributed capability discovery;
5. Ed25519 intent signatures and replay protection;
6. asynchronous and long-running execution;
7. append-only hash-chained audit records;
8. OpenDelegation Protocol and Proof-of-Human-Return authority checks for H2A2H.

## Repository layout

- src/index.ts — dependency-light TypeScript reference implementation.
- schemas/ — canonical JSON Schemas.
- docs/PROTOCOL.md — normative processing order and semantics.
- examples/ — interoperable example documents.
- test/ — conformance-oriented executable tests.
- .github/workflows/ci.yml — build and test validation.

## Core processing model

~~~text
document
  -> schema validation
  -> version and feature negotiation
  -> signature and replay verification
  -> delegation and human-return authority
  -> capability discovery
  -> idempotent execution
  -> audit trail
  -> result
~~~

## TypeScript usage

~~~ts
import { ExecutionStore, negotiate } from "@allascode/open-intent-protocol";
~~~

The reference implementation deliberately does not select a transport or treat discovery as authorization. OpenEntityChannels, HTTP/3, QUIC, NATS, Kafka and other adapters can be added without changing the semantic contract.

## H2A2H boundary

OpenIntent carries references and verifiable claims from OpenDelegation Protocol and Proof-of-Human-Return. It preserves the separation between:

- transport authentication;
- intent integrity;
- delegation authority;
- human-return evidence;
- policy decision;
- execution acceptance.

See docs/PROTOCOL.md for the normative ordering, reason codes and compatibility rules.

## Status

The repository is an evolving v0.1 reference implementation. The schemas and API are intentionally small enough to port to Zig, Go, Rust and other runtimes while preserving the same semantic behavior.
