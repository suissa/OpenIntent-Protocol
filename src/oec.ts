import {
  createHash,
  createHmac,
  timingSafeEqual,
} from "node:crypto";

export type OecChannel = "rest" | "websocket" | "grpc" | "mcp" | "stdio" | "local";
export type OecBodyKind = "payloadEnvelope" | "entitySchema" | "none";
export type OecStreamKind = "sse" | "ndjson" | "websocket";
export type OecVisibility = "internal" | "development";
export type OecMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface OecRouteDeclaration {
  name: string;
  method: OecMethod;
  path: string;
  behavior: string;
  body?: OecBodyKind;
  stream?: OecStreamKind;
  requiredHeaders?: string[];
  accept?: string[];
}

export interface OecChannelDeclaration {
  enabled: boolean;
  base?: string;
  routes: OecRouteDeclaration[];
}

export interface OecEntityDeclaration {
  schemaRef: string;
  idField: string;
  canonicalLabel?: string;
  channels: Partial<Record<OecChannel, OecChannelDeclaration>>;
}

export type OecHashInputName =
  | "entityName"
  | "entityId"
  | "behavior"
  | "channel"
  | "method"
  | "path"
  | "bodyKind";

export interface OecDeclaration {
  protocol: "EntityCommunicationProtocol";
  version: string;
  visibility: OecVisibility;
  defaults: {
    requiredHeaders: string[];
    hashing: {
      algorithm: "hmacSha256";
      secretRef: string;
      input: OecHashInputName[];
    };
  };
  entities: Record<string, OecEntityDeclaration>;
}

export interface OecValidationError {
  path: string;
  code: string;
  message: string;
}

export interface OecValidationResult {
  valid: boolean;
  reason_code?: OecReasonCode;
  errors?: OecValidationError[];
}

export type OecReasonCode =
  | "INVALID_DECLARATION"
  | "ENTITY_NOT_FOUND"
  | "CHANNEL_NOT_FOUND"
  | "CHANNEL_DISABLED"
  | "ROUTE_NOT_FOUND"
  | "METHOD_MISMATCH"
  | "PATH_MISMATCH"
  | "BODY_KIND_MISMATCH"
  | "STREAM_ACCEPT_MISMATCH"
  | "MISSING_REQUIRED_HEADER"
  | "INTENT_NOT_ACCEPTED"
  | "AUTHORITY_DENIED"
  | "UNTRUSTED_CALLER"
  | "ROUTE_HASH_MISSING"
  | "ROUTE_HASH_SECRET_UNAVAILABLE"
  | "ROUTE_HASH_INVALID"
  | "ROUTE_HASH_ALGORITHM_UNSUPPORTED";

export interface OecMetadata {
  [name: string]: string;
}

export interface OecCaller {
  agentId: string;
  trusted: boolean;
}

export interface OecDeliveryRequest {
  intentId: string;
  executionId: string;
  entity: string;
  entityId: string;
  behavior: string;
  channel: OecChannel;
  route: string;
  method: OecMethod;
  path: string;
  bodyKind: OecBodyKind;
  body?: unknown;
  streamAccept?: string;
  metadata: OecMetadata;
  caller: OecCaller;
  intentAccepted: boolean;
  authorizationDecision: "allowed" | "denied";
  crossesTrustBoundary: boolean;
  routeHash?: string;
}

export interface OecSecretProvider {
  resolve(secretRef: string): string | undefined;
}

export class MapOecSecretProvider implements OecSecretProvider {
  public constructor(private readonly secrets: Record<string, string>) {}

  public resolve(secretRef: string): string | undefined {
    return this.secrets[secretRef];
  }
}

export interface OecRouteHashInput {
  entityName: string;
  entityId: string;
  behavior: string;
  channel: OecChannel;
  method: OecMethod;
  path: string;
  bodyKind: OecBodyKind;
}

function stableRouteInput(
  input: OecRouteHashInput,
  order: OecHashInputName[],
): string {
  return order.map((field) => {
    const value = input[field];
    return `${field}=${String(value).length}:${String(value)}`;
  }).join("|");
}

export function computeOecRouteHash(
  input: OecRouteHashInput,
  declaration: OecDeclaration,
  secrets: OecSecretProvider,
): string {
  const secret = secrets.resolve(declaration.defaults.hashing.secretRef);
  if (!secret) throw new Error("ROUTE_HASH_SECRET_UNAVAILABLE");
  const canonical = stableRouteInput(input, declaration.defaults.hashing.input);
  return createHmac("sha256", secret).update(canonical, "utf8").digest("hex");
}

export function verifyOecRouteHash(
  input: OecRouteHashInput,
  providedHash: string | undefined,
  declaration: OecDeclaration,
  secrets: OecSecretProvider,
): OecValidationResult {
  if (declaration.defaults.hashing.algorithm !== "hmacSha256") {
    return { valid: false, reason_code: "ROUTE_HASH_ALGORITHM_UNSUPPORTED" };
  }
  if (!providedHash) return { valid: false, reason_code: "ROUTE_HASH_MISSING" };
  const secret = secrets.resolve(declaration.defaults.hashing.secretRef);
  if (!secret) {
    return { valid: false, reason_code: "ROUTE_HASH_SECRET_UNAVAILABLE" };
  }
  const expected = computeOecRouteHash(input, declaration, secrets);
  const left = Buffer.from(expected, "hex");
  const right = Buffer.from(providedHash, "hex");
  const valid = left.length === right.length && timingSafeEqual(left, right);
  return valid ? { valid: true } : { valid: false, reason_code: "ROUTE_HASH_INVALID" };
}

function splitPath(path: string): string[] {
  return path.replace(/^\/+|\/+$/g, "").split("/").filter(Boolean);
}

export function matchOecRoutePath(
  template: string,
  actualPath: string,
): { matched: boolean; params: Record<string, string> } {
  const expected = splitPath(template);
  const actual = splitPath(actualPath);
  if (expected.length !== actual.length) return { matched: false, params: {} };
  const params: Record<string, string> = {};
  for (let index = 0; index < expected.length; index += 1) {
    const expectedPart = expected[index];
    const actualPart = actual[index];
    if (expectedPart.startsWith(":")) {
      const name = expectedPart.slice(1);
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name) || !actualPart) {
        return { matched: false, params: {} };
      }
      try {
        params[name] = decodeURIComponent(actualPart);
      } catch {
        return { matched: false, params: {} };
      }
    } else if (decodeURIComponent(expectedPart) !== decodeURIComponent(actualPart)) {
      return { matched: false, params: {} };
    }
  }
  return { matched: true, params };
}

export function normalizeOecBodyKind(route: OecRouteDeclaration): OecBodyKind {
  if (route.body) return route.body;
  return route.stream ? "none" : "payloadEnvelope";
}

function metadataValue(metadata: OecMetadata, name: string): string | undefined {
  const expected = name.toLowerCase();
  const entry = Object.entries(metadata).find(([key]) => key.toLowerCase() === expected);
  return entry?.[1];
}

export function validateOecDeclaration(declaration: OecDeclaration): OecValidationResult {
  const errors: OecValidationError[] = [];
  if (declaration.protocol !== "EntityCommunicationProtocol") {
    errors.push({ path: "protocol", code: "PROTOCOL", message: "Unsupported OEC protocol" });
  }
  if (!/^\d+\.\d+\.\d+$/.test(declaration.version)) {
    errors.push({ path: "version", code: "VERSION", message: "Version must be semver" });
  }
  if (declaration.visibility !== "internal" && declaration.visibility !== "development") {
    errors.push({ path: "visibility", code: "VISIBILITY", message: "OEC visibility must be internal or development" });
  }
  if (declaration.defaults.hashing.algorithm !== "hmacSha256" || !declaration.defaults.hashing.secretRef) {
    errors.push({ path: "defaults.hashing", code: "HASHING", message: "OEC requires HMAC-SHA256 and a secret reference" });
  }
  if (declaration.defaults.hashing.input.length === 0) {
    errors.push({ path: "defaults.hashing.input", code: "HASH_INPUT", message: "Hash input order cannot be empty" });
  }
  for (const [entityName, entity] of Object.entries(declaration.entities)) {
    if (!entity.idField) errors.push({ path: `entities.${entityName}.idField`, code: "IDENTITY", message: "Entity idField is required" });
    if (!entity.schemaRef) errors.push({ path: `entities.${entityName}.schemaRef`, code: "SCHEMA_REF", message: "Entity schemaRef is required" });
    for (const [channel, config] of Object.entries(entity.channels)) {
      if (!config) continue;
      const seen = new Set<string>();
      for (const route of config.routes) {
        if (seen.has(route.name)) errors.push({ path: `entities.${entityName}.channels.${channel}.routes`, code: "DUPLICATE_ROUTE", message: `Duplicate route ${route.name}` });
        seen.add(route.name);
        if (!route.behavior) errors.push({ path: `${entityName}.${channel}.${route.name}.behavior`, code: "BEHAVIOR", message: "Behavior reference is required" });
        if (!route.path.startsWith("/")) errors.push({ path: `${entityName}.${channel}.${route.name}.path`, code: "PATH", message: "Route path must start with /" });
        if (route.stream && route.body && route.body !== "none") errors.push({ path: `${entityName}.${channel}.${route.name}.body`, code: "STREAM_BODY", message: "Stream routes must use body none" });
        for (const header of [...(declaration.defaults.requiredHeaders ?? []), ...(route.requiredHeaders ?? [])]) {
          if (!/^X-OEC-[A-Za-z0-9-]+$/.test(header)) errors.push({ path: `${entityName}.${channel}.${route.name}.requiredHeaders`, code: "HEADER", message: `Invalid OEC metadata name ${header}` });
        }
      }
    }
  }
  return errors.length === 0 ? { valid: true } : { valid: false, reason_code: "INVALID_DECLARATION", errors };
}

function findRoute(declaration: OecDeclaration, request: OecDeliveryRequest): OecRouteDeclaration | undefined {
  return declaration.entities[request.entity]?.channels[request.channel]?.routes.find(
    (route) => route.name === request.route,
  );
}

export function validateOecDelivery(
  declaration: OecDeclaration,
  request: OecDeliveryRequest,
  secrets?: OecSecretProvider,
): OecValidationResult {
  const declarationResult = validateOecDeclaration(declaration);
  if (!declarationResult.valid) return declarationResult;
  if (!request.intentAccepted) return { valid: false, reason_code: "INTENT_NOT_ACCEPTED" };
  if (request.authorizationDecision !== "allowed") return { valid: false, reason_code: "AUTHORITY_DENIED" };
  if (!request.caller.trusted) return { valid: false, reason_code: "UNTRUSTED_CALLER" };
  const entity = declaration.entities[request.entity];
  if (!entity) return { valid: false, reason_code: "ENTITY_NOT_FOUND" };
  const channel = entity.channels[request.channel];
  if (!channel) return { valid: false, reason_code: "CHANNEL_NOT_FOUND" };
  if (!channel.enabled) return { valid: false, reason_code: "CHANNEL_DISABLED" };
  const route = findRoute(declaration, request);
  if (!route) return { valid: false, reason_code: "ROUTE_NOT_FOUND" };
  if (route.method !== request.method) return { valid: false, reason_code: "METHOD_MISMATCH" };
  const match = matchOecRoutePath(`${channel.base ?? ""}${route.path}`, request.path);
  if (!match.matched) return { valid: false, reason_code: "PATH_MISMATCH" };
  if (normalizeOecBodyKind(route) !== request.bodyKind) return { valid: false, reason_code: "BODY_KIND_MISMATCH" };
  if (request.bodyKind === "none" && request.body !== undefined) return { valid: false, reason_code: "BODY_KIND_MISMATCH" };
  if (route.stream && (!request.streamAccept || !route.accept?.includes(request.streamAccept))) {
    return { valid: false, reason_code: "STREAM_ACCEPT_MISMATCH" };
  }
  const required = new Set([
    ...declaration.defaults.requiredHeaders,
    ...(route.requiredHeaders ?? []),
  ]);
  for (const header of required) {
    if (!metadataValue(request.metadata, header)) return { valid: false, reason_code: "MISSING_REQUIRED_HEADER" };
  }
  if (request.crossesTrustBoundary) {
    if (!request.routeHash) return { valid: false, reason_code: "ROUTE_HASH_MISSING" };
    if (!secrets) return { valid: false, reason_code: "ROUTE_HASH_SECRET_UNAVAILABLE" };
    const hashResult = verifyOecRouteHash({
      entityName: request.entity,
      entityId: request.entityId,
      behavior: request.behavior,
      channel: request.channel,
      method: request.method,
      path: request.path,
      bodyKind: request.bodyKind,
    }, request.routeHash, declaration, secrets);
    if (!hashResult.valid) return hashResult;
  }
  if (route.behavior !== request.behavior) return { valid: false, reason_code: "ROUTE_NOT_FOUND" };
  return { valid: true };
}

export const OEC_TRACE_EVENTS = [
  "oec.intent.accepted",
  "oec.authority.decided",
  "oec.route.selected",
  "oec.route_hash.verified",
  "oec.route_hash.failed",
  "oec.metadata.propagated",
  "oec.delivery.started",
  "oec.delivery.completed",
  "oec.delivery.rejected",
  "oec.audit.appended",
  "oec.conformance.generated",
  "oec.conformance.case",
] as const;

export type OecTraceEventName = typeof OEC_TRACE_EVENTS[number];

export interface OecTraceEvent {
  event: OecTraceEventName;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  intent_id?: string;
  execution_id?: string;
  entity?: string;
  entity_id?: string;
  behavior?: string;
  channel?: OecChannel;
  route?: string;
  route_hash?: string;
  route_integrity?: "verified" | "failed" | "not_required";
  authorization_decision?: "allowed" | "denied";
  reason_code?: string;
  duration_ms?: number;
  internal: true;
}

export class OecTrace {
  private readonly events: OecTraceEvent[] = [];

  public emit(event: OecTraceEvent): void {
    if (event.internal !== true) throw new Error("OEC_TRACE_MUST_BE_INTERNAL");
    this.events.push({ ...event });
  }

  public list(): OecTraceEvent[] {
    return this.events.map((event) => ({ ...event }));
  }
}

export interface OecOpenApiDocument {
  openapi: "3.1.0";
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  "x-oec-visibility": "internal";
  "x-oec-channels": Array<{ channel: OecChannel; entity: string; visibility: "internal" }>;
}

function openApiPath(path: string): string {
  return path.replace(/:([A-Za-z][A-Za-z0-9_]*)/g, "{$1}");
}

export function generateOecOpenApi(declaration: OecDeclaration): OecOpenApiDocument {
  const result: OecOpenApiDocument = {
    openapi: "3.1.0",
    info: { title: "OpenEntity Channels (internal)", version: declaration.version },
    paths: {},
    "x-oec-visibility": "internal",
    "x-oec-channels": [],
  };
  for (const [entityName, entity] of Object.entries(declaration.entities)) {
    for (const [channel, config] of Object.entries(entity.channels) as Array<[OecChannel, OecChannelDeclaration | undefined]>) {
      if (!config) continue;
      result["x-oec-channels"].push({ channel, entity: entityName, visibility: "internal" });
      if (channel !== "rest" || !config.enabled) continue;
      for (const route of config.routes) {
        const path = openApiPath(`${config.base ?? ""}${route.path}`);
        const method = route.method.toLowerCase();
        const bodyKind = normalizeOecBodyKind(route);
        const operation: Record<string, unknown> = {
          operationId: `${entityName}.${route.name}`,
          responses: { "200": { description: "OEC internal response" } },
          "x-oec-visibility": "internal",
          "x-oec-channel": "rest",
          "x-oec-behavior": route.behavior,
          "x-oec-body-kind": bodyKind,
        };
        const parameters = [...path.matchAll(/\{([A-Za-z][A-Za-z0-9_]*)\}/g)].map((match) => ({
          name: match[1], in: "path", required: true, schema: { type: "string" },
        }));
        if (parameters.length > 0) operation.parameters = parameters;
        if (bodyKind !== "none") operation.requestBody = { required: true, content: { "application/json": { schema: {} } } };
        if (route.stream) {
          operation["x-oec-stream"] = route.stream;
          const contentType = route.stream === "sse" ? "text/event-stream" : "application/x-ndjson";
          operation.responses = { "200": { description: "OEC stream", content: { [contentType]: {} } } };
        }
        result.paths[path] ??= {};
        result.paths[path][method] = operation;
      }
    }
  }
  return result;
}

export interface OecRoutingContext {
  locality: "same-process" | "same-host" | "remote";
  realtime?: boolean;
  subprocess?: boolean;
  agentTool?: boolean;
  serviceToService?: boolean;
  availableChannels: OecChannel[];
}

export interface OecRoutingDecision {
  channel: OecChannel;
  reason: string;
}

export function selectOecBinding(context: OecRoutingContext): OecRoutingDecision {
  const preferences: Array<[OecChannel, string]> = context.subprocess
    ? [["stdio", "subprocess-tool"]]
    : context.locality === "same-process"
      ? [["local", "same-process"], ["grpc", "same-host-service"], ["rest", "compatibility"]]
      : context.realtime
        ? [["websocket", "realtime"], ["rest", "stream-compatible"]]
        : context.agentTool
          ? [["mcp", "agent-tool"], ["grpc", "service-rpc"], ["rest", "compatibility"]]
          : context.serviceToService
            ? [["grpc", "service-rpc"], ["rest", "compatibility"]]
            : [["grpc", "safe-internal-default"], ["rest", "compatibility"]];
  const choice = preferences.find(([channel]) => context.availableChannels.includes(channel));
  if (!choice) throw new Error("NO_SAFE_OEC_BINDING");
  return { channel: choice[0], reason: choice[1] };
}

export interface OecDeliveryPlan {
  intent_id: string;
  execution_id: string;
  entity: string;
  entity_id: string;
  behavior: string;
  channel: OecChannel;
  route: string;
  route_hash?: string;
  visibility: "internal";
  policy_reason: string;
}

export interface OecConformanceCase {
  id: string;
  kind: "happy" | "missing-header" | "method-mismatch" | "path-mismatch" | "body-mismatch" | "stream-accept";
  expected?: OecReasonCode;
}

export interface OecConformanceManifest {
  profile: "oec-0.1.0";
  declaration_sha256: string;
  generator: string;
  cases: OecConformanceCase[];
}

export function generateOecConformanceCases(declaration: OecDeclaration): OecConformanceCase[] {
  const cases: OecConformanceCase[] = [];
  for (const [entityName, entity] of Object.entries(declaration.entities)) {
    for (const [channelName, channel] of Object.entries(entity.channels)) {
      if (!channel) continue;
      for (const route of channel.routes) {
        const prefix = `${entityName}.${channelName}.${route.name}`;
        if (channel.enabled) {
          cases.push({ id: `${prefix}.happy`, kind: "happy" });
          cases.push({ id: `${prefix}.missing-header`, kind: "missing-header", expected: "MISSING_REQUIRED_HEADER" });
          cases.push({ id: `${prefix}.method-mismatch`, kind: "method-mismatch", expected: "METHOD_MISMATCH" });
          cases.push({ id: `${prefix}.path-mismatch`, kind: "path-mismatch", expected: "PATH_MISMATCH" });
          cases.push({ id: `${prefix}.body-mismatch`, kind: "body-mismatch", expected: "BODY_KIND_MISMATCH" });
          if (route.stream) cases.push({ id: `${prefix}.stream-accept`, kind: "stream-accept", expected: "STREAM_ACCEPT_MISMATCH" });
        }
      }
    }
  }
  return cases;
}

export function generateOecConformanceManifest(
  declaration: OecDeclaration,
  generator = "@allascode/open-intent-protocol/oec",
): OecConformanceManifest {
  return {
    profile: "oec-0.1.0",
    declaration_sha256: declarationDigest(declaration),
    generator,
    cases: generateOecConformanceCases(declaration),
  };
}

export function declarationDigest(declaration: OecDeclaration): string {
  return createHash("sha256").update(JSON.stringify(declaration), "utf8").digest("hex");
}
