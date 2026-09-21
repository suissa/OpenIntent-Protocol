import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  MapOecSecretProvider,
  OecTrace,
  computeOecRouteHash,
  generateOecConformanceCases,
  generateOecConformanceManifest,
  generateOecOpenApi,
  matchOecRoutePath,
  selectOecBinding,
  validateOecDeclaration,
  validateOecDelivery,
  type OecDeclaration,
  type OecDeliveryRequest,
} from "../src/index.js";

const declaration: OecDeclaration = {
  protocol: "EntityCommunicationProtocol",
  version: "0.1.0",
  visibility: "internal",
  defaults: {
    requiredHeaders: ["X-OEC-Trace-Id", "X-OEC-Agent-Id"],
    hashing: {
      algorithm: "hmacSha256",
      secretRef: "test://oec/route-hash",
      input: ["entityName", "entityId", "behavior", "channel", "method", "path", "bodyKind"],
    },
  },
  entities: {
    User: {
      schemaRef: "./entities/User.json",
      idField: "id",
      canonicalLabel: "name",
      channels: {
        rest: {
          enabled: true,
          base: "/users",
          routes: [
            { name: "get", method: "GET", path: "/:id", behavior: "User.read", body: "none" },
            { name: "observe", method: "GET", path: "/:id/events", behavior: "User.observe", stream: "sse", accept: ["text/event-stream"] },
          ],
        },
        grpc: {
          enabled: true,
          routes: [{ name: "get", method: "GET", path: "/:id", behavior: "User.read", body: "none" }],
        },
        local: {
          enabled: true,
          routes: [{ name: "get", method: "GET", path: "/:id", behavior: "User.read", body: "none" }],
        },
        websocket: { enabled: true, routes: [] },
      },
    },
  },
};

const secrets = new MapOecSecretProvider({ "test://oec/route-hash": "test-secret" });

function validRequest(overrides: Partial<OecDeliveryRequest> = {}): OecDeliveryRequest {
  return {
    intentId: "intent:user-read",
    executionId: "exec:1",
    entity: "User",
    entityId: "user-1",
    behavior: "User.read",
    channel: "rest",
    route: "get",
    method: "GET",
    path: "/users/user-1",
    bodyKind: "none",
    metadata: { "X-OEC-Trace-Id": "trace:1", "X-OEC-Agent-Id": "agent:internal" },
    caller: { agentId: "agent:internal", trusted: true },
    intentAccepted: true,
    authorizationDecision: "allowed",
    crossesTrustBoundary: false,
    ...overrides,
  };
}

test("validates the canonical OEC declaration", () => {
  assert.deepEqual(validateOecDeclaration(declaration), { valid: true });
});

test("matches :id and :token-style route parameters", () => {
  assert.deepEqual(matchOecRoutePath("/users/:id", "/users/user-1"), {
    matched: true,
    params: { id: "user-1" },
  });
  assert.equal(matchOecRoutePath("/users/:id", "/other/user-1").matched, false);
});

test("validates internal delivery and keeps route integrity separate from authority", () => {
  const request = validRequest({ crossesTrustBoundary: true });
  request.routeHash = computeOecRouteHash({
    entityName: "User",
    entityId: request.entityId,
    behavior: request.behavior,
    channel: request.channel,
    method: request.method,
    path: request.path,
    bodyKind: request.bodyKind,
  }, declaration, secrets);
  assert.deepEqual(validateOecDelivery(declaration, request, secrets), { valid: true });
  assert.deepEqual(
    validateOecDelivery(declaration, { ...request, authorizationDecision: "denied" }, secrets),
    { valid: false, reason_code: "AUTHORITY_DENIED" },
  );
  assert.deepEqual(
    validateOecDelivery(declaration, { ...request, routeHash: "0".repeat(64) }, secrets),
    { valid: false, reason_code: "ROUTE_HASH_INVALID" },
  );
  assert.deepEqual(
    validateOecDelivery(declaration, request),
    { valid: false, reason_code: "ROUTE_HASH_SECRET_UNAVAILABLE" },
  );
});

test("rejects body, method, path, channel and public-boundary violations", () => {
  assert.equal(validateOecDelivery(declaration, validRequest({ bodyKind: "payloadEnvelope" })).reason_code, "BODY_KIND_MISMATCH");
  assert.equal(validateOecDelivery(declaration, validRequest({ method: "POST" })).reason_code, "METHOD_MISMATCH");
  assert.equal(validateOecDelivery(declaration, validRequest({ path: "/users/other/user-1" })).reason_code, "PATH_MISMATCH");
  assert.equal(validateOecDelivery(declaration, validRequest({ channel: "websocket" })).reason_code, "ROUTE_NOT_FOUND");
  assert.equal(validateOecDelivery(declaration, validRequest({ intentAccepted: false })).reason_code, "INTENT_NOT_ACCEPTED");
  assert.equal(validateOecDelivery(declaration, validRequest({ caller: { agentId: "public", trusted: false } })).reason_code, "UNTRUSTED_CALLER");
});

test("requires stream-compatible accept metadata", () => {
  const streamRequest = validRequest({
    route: "observe",
    behavior: "User.observe",
    path: "/users/user-1/events",
    streamAccept: "text/event-stream",
  });
  assert.deepEqual(validateOecDelivery(declaration, streamRequest), { valid: true });
  assert.equal(validateOecDelivery(declaration, { ...streamRequest, streamAccept: undefined }).reason_code, "STREAM_ACCEPT_MISMATCH");
});

test("generates internal OpenAPI without a request body for none and stream routes", () => {
  const document = generateOecOpenApi(declaration);
  assert.equal(document.openapi, "3.1.0");
  assert.equal(document["x-oec-visibility"], "internal");
  assert.ok(document.paths["/users/{id}"]?.get);
  assert.equal("requestBody" in (document.paths["/users/{id}"]?.get as object), false);
  const stream = document.paths["/users/{id}/events"]?.get as Record<string, unknown>;
  assert.equal(stream["x-oec-stream"], "sse");
  assert.equal((stream.responses as Record<string, unknown>)["200"] !== undefined, true);
});

test("selects deterministic safe bindings", () => {
  assert.deepEqual(selectOecBinding({ locality: "same-process", availableChannels: ["local", "grpc"] }), { channel: "local", reason: "same-process" });
  assert.deepEqual(selectOecBinding({ locality: "remote", serviceToService: true, availableChannels: ["rest", "grpc"] }), { channel: "grpc", reason: "service-rpc" });
  assert.deepEqual(selectOecBinding({ locality: "remote", subprocess: true, availableChannels: ["stdio"] }), { channel: "stdio", reason: "subprocess-tool" });
});

test("generates deterministic conformance cases from the declaration", () => {
  const cases = generateOecConformanceCases(declaration);
  assert.ok(cases.some((entry) => entry.id === "User.rest.get.happy"));
  assert.ok(cases.some((entry) => entry.id === "User.rest.observe.stream-accept"));
  assert.equal(cases.filter((entry) => entry.kind === "happy").length, 4);
  const manifest = generateOecConformanceManifest(declaration);
  assert.equal(manifest.profile, "oec-0.1.0");
  assert.equal(manifest.declaration_sha256.length, 64);
  assert.equal(manifest.cases.length, cases.length);
});

test("emits only internal OEC trace events", () => {
  const trace = new OecTrace();
  trace.emit({
    event: "oec.route.selected",
    trace_id: "trace:1",
    span_id: "span:1",
    intent_id: "intent:user-read",
    entity: "User",
    behavior: "User.read",
    channel: "rest",
    route: "get",
    authorization_decision: "allowed",
    route_integrity: "not_required",
    internal: true,
  });
  assert.equal(trace.list()[0].internal, true);
  assert.equal(trace.list()[0].authorization_decision, "allowed");
  assert.throws(() => trace.emit({ event: "oec.delivery.started", trace_id: "t", span_id: "s", internal: false as true }), /OEC_TRACE_MUST_BE_INTERNAL/);
});

test("ships valid JSON Schema documents for the executable profile", () => {
  for (const path of [
    "schemas/oec-declaration.schema.json",
    "schemas/oec-delivery-request.schema.json",
    "schemas/oec-delivery-plan.schema.json",
    "schemas/oec-trace-event.schema.json",
    "schemas/oec-conformance-manifest.schema.json",
    "schemas/oec-openapi.schema.json",
  ]) {
    const schema = JSON.parse(readFileSync(path, "utf8")) as { $schema?: string; required?: string[] };
    assert.equal(schema.$schema, "https://json-schema.org/draft/2020-12/schema");
    assert.ok((schema.required?.length ?? 0) > 0);
  }
});
