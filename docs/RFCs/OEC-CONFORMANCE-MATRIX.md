# OEC Conformance Matrix

This matrix binds every normative requirement to an executable schema, positive fixture, negative fixture and observable internal trace event.

The declaration source is examples/oec-user.json. The implementation is src/oec.ts; generated evidence is produced by npm run generate:oec.

## Schema anchors

| Code | Artifact |
| --- | --- |
| I/A | Existing OpenIntent intent and authority schemas |
| S1 | schemas/oec-declaration.schema.json |
| S2 | schemas/oec-delivery-request.schema.json |
| S3 | OEC metadata fields in S2 |
| S4 | HMAC-SHA256 route hash contract in S1/S2 |
| S5 | schemas/oec-openapi.schema.json |
| S6 | schemas/oec-conformance-manifest.schema.json |
| S7 | schemas/oec-delivery-plan.schema.json |
| S8 | schemas/oec-trace-event.schema.json |

## Fixture and evidence anchors

| Code | Meaning |
| --- | --- |
| P1 | Same entity/behavior/body semantics across bindings |
| P2 | Accepted intent plus allowed authority reaches OEC |
| P3 | Trusted internal caller reaches OEC |
| P4 | Same entity identity is preserved |
| P5 | Enabled channel is selected |
| P6 | Trace, agent and intent metadata propagate |
| P7 | Documentation and tests share declaration SHA-256 |
| P8 | Valid identity, route and behavior declaration |
| P9 | Explicit route metadata narrowing |
| P10 | Stream/no-body route omits request body |
| P11 | Correct HMAC with test secret provider |
| P12 | Valid OpenAPI and grouped path methods |
| P13 | Generated happy and invalid cases are deterministic |
| P14 | Deterministic local/gRPC/WebSocket/MCP/STDIO policy |
| P15 | Route selection and terminal result are audited |
| N1 | Direct entity route or missing accepted intent |
| N2 | Untrusted caller or denied authority |
| N3 | Entity/route identity mismatch |
| N4 | Disabled or unavailable channel |
| N5 | Missing required metadata |
| N6 | Declaration digest mismatch |
| N7 | Missing identity, behavior or invalid path |
| N8 | Body/stream mismatch |
| N9 | Wrong method or path parameter |
| N10 | Wrong hash, hash order or unavailable secret |
| N11 | Secret value or public OEC exposure |
| N12 | Non-deterministic or live-dependent test |

Trace events are internal only: oec.intent.accepted, oec.authority.decided, oec.route.selected, oec.route_hash.verified, oec.route_hash.failed, oec.metadata.propagated, oec.delivery.started, oec.delivery.completed, oec.delivery.rejected, oec.audit.appended, oec.conformance.generated and oec.conformance.case.

## Requirement mapping

| Requirement | Schema | Positive | Negative | Trace evidence |
| --- | --- | --- | --- | --- |
| OEC-0000.1 transport-neutral | S1/S7 | P1 | N3 | delivery.completed |
| OEC-0000.2 no authority bypass | I/A/S2 | P2 | N1 | authority.decided/rejected |
| OEC-0000.3 trusted delivery | S2/S3 | P3 | N2 | delivery.rejected |
| OEC-0000.4 stable identity | S1/S7 | P4 | N3 | route.selected |
| OEC-0000.5 multiple bindings | S1 | P5 | N4 | route.selected |
| OEC-0000.6 audit propagation | S3/S8 | P6 | N5 | metadata.propagated |
| OEC-0000.7 generated conformance | S6 | P7 | N6 | conformance.generated |
| OEC-0001.1 public intent boundary | I/S2 | P2 | N1 | intent.accepted/rejected |
| OEC-0001.2 no public OEC authority | A/S2 | P2 | N2 | authority.decided |
| OEC-0001.3 authority before delivery | I/A/S2 | P2 | N1 | authority.decided |
| OEC-0001.4 bind accepted intent | S2/S7 | P2 | N1 | route.selected |
| OEC-0001.5 preserve audit correlation | S8 | P6 | N5 | audit.appended |
| OEC-0001.6 trusted runtime only | S2/S3 | P3 | N2 | delivery.rejected |
| OEC-0001.7 development exposure | S2/S5 | P3 | N11 | delivery.rejected |
| OEC-0002.1 entity identity field | S1 | P8 | N7 | conformance.case |
| OEC-0002.2 canonical label | S1 | P8 | N7 | conformance.case |
| OEC-0002.3 channel enabled | S1 | P5 | N4 | delivery.rejected |
| OEC-0002.4 channel semantics | S1/S7 | P1 | N3 | delivery.completed |
| OEC-0002.5 explicit metadata override | S1/S3 | P9 | N5 | conformance.case |
| OEC-0002.6 missing body normalization | S1/S5 | P10 | N8 | openapi.generated |
| OEC-0002.7 stable behavior reference | S1 | P8 | N7 | conformance.case |
| OEC-0002.8 multi-channel behavior | S1 | P1 | N4 | route.selected |
| OEC-0003.1 binding preservation | S1/S7 | P1 | N3 | delivery.completed |
| OEC-0003.2 security preservation | A/S2 | P2 | N2 | authority.decided |
| OEC-0003.3 boundary hash | S3/S4 | P11 | N10 | route_hash.verified |
| OEC-0003.4 gRPC preference | S7 | P14 | N4 | route.selected |
| OEC-0003.5 WebSocket preference | S7 | P14 | N4 | route.selected |
| OEC-0003.6 STDIO preference | S7 | P14 | N4 | route.selected |
| OEC-0003.7 local preference | S7 | P14 | N4 | route.selected |
| OEC-0003.8 REST tooling | S5 | P12 | N11 | openapi.generated |
| OEC-0004.1 required metadata | S1/S2 | P6 | N5 | delivery.rejected |
| OEC-0004.2 explicit narrowing | S1/S3 | P9 | N5 | conformance.case |
| OEC-0004.3 boundary metadata | S2/S3 | P6 | N5 | metadata.propagated |
| OEC-0004.4 ordered hash input | S4 | P11 | N10 | route_hash.verified/failed |
| OEC-0004.5 secret reference only | S4/S5 | P11 | N11 | openapi.generated |
| OEC-0004.6 fail closed secret | S4 | P11 | N10 | route_hash.failed |
| OEC-0004.7 hash is not authority | A/S4 | P2/P11 | N2 | authority.decided |
| OEC-0004.8 stable metadata names | S3 | P6 | N5 | metadata.propagated |
| OEC-0005.1 valid OpenAPI 3.1 | S5 | P12 | N11 | openapi.generated |
| OEC-0005.2 REST paths | S5 | P12 | N9 | openapi.generated |
| OEC-0005.3 parameter conversion | S5 | P12 | N9 | openapi.generated |
| OEC-0005.4 grouped methods | S5 | P12 | N9 | openapi.generated |
| OEC-0005.5 no request body | S5 | P10 | N8 | openapi.generated |
| OEC-0005.6 stream normalization | S1/S5 | P10 | N8 | openapi.generated |
| OEC-0005.7 non-REST extensions | S5 | P12 | N11 | openapi.generated |
| OEC-0005.8 no secret exposure | S4/S5 | P11 | N11 | openapi.generated |
| OEC-0005.9 behavior diagnostics | S5 | P12 | N7 | openapi.generated |
| OEC-0006.1 same declaration | S6 | P7 | N6 | conformance.generated |
| OEC-0006.2 happy path/channel | S6 | P13 | N4 | conformance.case |
| OEC-0006.3 missing metadata | S6/S3 | P13 | N5 | conformance.case |
| OEC-0006.4 method/path/body | S6/S5 | P13 | N9 | conformance.case |
| OEC-0006.5 stream accept | S6/S5 | P13 | N8 | conformance.case |
| OEC-0006.6 behavior invalid state | S6 | P13 | N7 | conformance.case |
| OEC-0006.7 deterministic tests | S6 | P13 | N12 | conformance.case |
| OEC-0006.8 no live secrets/network | S4/S6 | P13 | N10 | conformance.case |
| OEC-0007.1 intents/events only | I/S2 | P2 | N1 | intent.accepted |
| OEC-0007.2 resolve before behavior | I/S7 | P2 | N3 | route.selected |
| OEC-0007.3 cheapest safe binding | S7 | P14 | N4 | route.selected |
| OEC-0007.4 same-process local | S7 | P14 | N4 | route.selected |
| OEC-0007.5 service gRPC | S7 | P14 | N4 | route.selected |
| OEC-0007.6 realtime binding | S7 | P14 | N4 | route.selected |
| OEC-0007.7 subprocess STDIO | S7 | P14 | N4 | route.selected |
| OEC-0007.8 boundary metadata | S3/S4/S8 | P6/P11 | N5/N10 | metadata.propagated |
| OEC-0007.9 audit selection/result | S8/AU | P15 | N5 | audit.appended |

## Security invariants

- route_hash proves route-input integrity only.
- authorization_decision comes from the OpenIntent authority boundary.
- A valid route hash cannot authorize a denied intent.
- Missing route-hash secrets fail closed.
- OEC requests, plans, traces and generated OpenAPI are internal artifacts.
