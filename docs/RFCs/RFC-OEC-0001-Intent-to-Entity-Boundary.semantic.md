# RFC-OEC-0001: Intent-to-Entity Boundary

## Status

Implemented reference profile.

## Category

Semantic.

## Version

0.1.0.

## Depends-On

RFC-OEC-0000 and the OpenIntent authority boundary.

## Purpose

This RFC defines the boundary between user-facing intentions and internal entity channels. Users do not call entities directly. Users express or trigger intents. The orchestrator maps an accepted intent to one or more entity behaviors and uses OEC to deliver the work internally.

This preserves agency, auditability and security: the public surface remains an intent contract, while entity channels remain an internal execution fabric.

## Terminology

- User intent: externally requested goal.
- Entity operation: internal behavior execution against an entity.
- Intent router: component that selects the next behavior for an accepted intent.
- Capability binding: mapping from intent to entity behavior and allowed channel.

## Normative Requirements

1. External users MUST NOT be required to know entity routes, channel names or transport details.
2. External users MUST NOT receive direct authority over entity channels.
3. The orchestrator MUST validate intent authority before using OEC.
4. The orchestrator MUST bind each OEC delivery to the accepted intent identifier.
5. The orchestrator MUST preserve audit correlation from external request to internal entity behavior.
6. Entity channels MUST be callable only by trusted runtimes, agents or adapters.
7. A channel MAY be exposed for development, conformance or local testing, but that exposure MUST NOT be treated as production authority.

## Invariants

- Intent is the public contract.
- Entity channel is the private delivery mechanism.
- A valid channel request without a valid accepted intent is not sufficient for production execution.
- A route hash identifies a delivery route; it does not authorize a user.

## Examples

```text
WhatsApp webhook
  -> message normalization
  -> OpenIntent classification
  -> intent acceptance
  -> Patient.ScheduleConsultation
  -> OEC delivery to Consulta.create or Medico.availability.search
```

The user sees "schedule consultation". The orchestrator may use `Paciente`, `Medico`, `Consulta`, `Documento`, `Pagamento` and `WhatsAppMessage` entity behaviors internally.

## Conformance Tests

A conformant implementation SHOULD test that:

- no public intent handler requires a raw entity route;
- internal OEC delivery includes an intent correlation id;
- unauthenticated direct entity-channel calls are rejected in production profile;
- orchestrator-selected channels are auditable.

## Implementation Notes

For the current WhatsApp-first orchestrator, the webhook receiver should create or resume an OpenIntent execution. Only after the accepted intent reaches the capability-selection phase should OEC be used to deliver to an entity behavior.

## Open Questions

- Whether the orchestrator should persist the chosen channel in the audit record or only persist the selected capability and route hash.
- Whether development mode may expose REST channels directly on localhost.


## Executable reference profile

`validateOecDelivery` is the executable boundary. It rejects direct entity delivery without accepted intent context, authority approval or a trusted caller. The request carries `intentId` and `executionId`; the public contract remains the OpenIntent document.

`OecDeliveryRequest` is internal and is not exposed as a public endpoint contract.

