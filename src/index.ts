import {
  createHash,
  generateKeyPairSync,
  sign,
  verify,
  type KeyObject,
} from "node:crypto";

export const OIP_PROTOCOL_VERSION = "1.0.0";
export const OIP_SIGNATURE_ALGORITHM = "Ed25519";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type CompatibilityMode = "exact" | "backward" | "forward" | "same-major";

export interface Intent {
  id: string;
  type: string;
  protocol_version: string;
  contract_version: string;
  actor: string;
  capability: string;
  input: JsonValue;
  requested_features?: string[];
  idempotency_key?: string;
  causation_id?: string;
  extensions?: Record<string, JsonValue>;
}

export interface NegotiationRequest {
  protocol_versions: string[];
  contract_versions: string[];
  required_features: string[];
  compatibility: CompatibilityMode;
}

export interface NegotiationResponse {
  accepted: boolean;
  protocol_version?: string;
  contract_version?: string;
  features: string[];
  reason_code?: "NO_PROTOCOL_MATCH" | "NO_CONTRACT_MATCH" | "REQUIRED_FEATURE_UNSUPPORTED";
}

interface Semver {
  major: number;
  minor: number;
  patch: number;
}

function parseSemver(version: string): Semver {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:-[0-9A-Za-z.-]+)?$/.exec(version);
  if (!match) {
    throw new Error("INVALID_VERSION");
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

function compareSemver(left: string, right: string): number {
  const a = parseSemver(left);
  const b = parseSemver(right);
  return (a.major - b.major) || (a.minor - b.minor) || (a.patch - b.patch);
}

function compatible(requested: string, offered: string, mode: CompatibilityMode): boolean {
  const a = parseSemver(requested);
  const b = parseSemver(offered);
  if (mode === "exact") return requested === offered;
  if (mode === "same-major") return a.major === b.major;
  if (mode === "backward") return a.major === b.major && b.minor >= a.minor;
  return a.major === b.major && b.minor <= a.minor;
}

function highestCompatible(requested: string[], offered: string[], mode: CompatibilityMode): string | undefined {
  const candidates = offered.filter((candidate) =>
    requested.some((wanted) => compatible(wanted, candidate, mode)),
  );
  return candidates.sort((a, b) => compareSemver(b, a))[0];
}

export function negotiate(
  request: NegotiationRequest,
  offered: NegotiationRequest,
): NegotiationResponse {
  const protocol = highestCompatible(
    request.protocol_versions,
    offered.protocol_versions,
    request.compatibility,
  );
  if (!protocol) {
    return { accepted: false, features: [], reason_code: "NO_PROTOCOL_MATCH" };
  }

  const contract = highestCompatible(
    request.contract_versions,
    offered.contract_versions,
    request.compatibility,
  );
  if (!contract) {
    return { accepted: false, features: [], reason_code: "NO_CONTRACT_MATCH" };
  }

  const features = request.required_features.filter((feature) =>
    offered.required_features.includes(feature),
  );
  if (features.length !== request.required_features.length) {
    return {
      accepted: false,
      protocol_version: protocol,
      contract_version: contract,
      features,
      reason_code: "REQUIRED_FEATURE_UNSUPPORTED",
    };
  }

  return {
    accepted: true,
    protocol_version: protocol,
    contract_version: contract,
    features,
  };
}

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return "[" + value.map((entry) => canonicalize(entry)).join(",") + "]";
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record)
    .filter((key) => record[key] !== undefined)
    .sort();
  return "{" + keys.map((key) =>
    JSON.stringify(key) + ":" + canonicalize(record[key]),
  ).join(",") + "}";
}

export function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export interface SignatureEnvelope {
  algorithm: typeof OIP_SIGNATURE_ALGORITHM;
  key_id: string;
  signer: string;
  nonce: string;
  issued_at: string;
  expires_at: string;
  payload_hash: string;
  signature: string;
}

export interface VerificationResult {
  valid: boolean;
  reason_code?:
    | "UNSUPPORTED_ALGORITHM"
    | "SIGNATURE_EXPIRED"
    | "SIGNATURE_NOT_YET_VALID"
    | "PAYLOAD_MUTATED"
    | "SIGNATURE_INVALID"
    | "REPLAY_DETECTED";
}

export function createEd25519KeyPair(): { publicKey: KeyObject; privateKey: KeyObject } {
  return generateKeyPairSync("ed25519");
}

export function signIntent(
  intent: Intent,
  privateKey: KeyObject,
  metadata: Omit<SignatureEnvelope, "algorithm" | "payload_hash" | "signature">,
): SignatureEnvelope {
  const bytes = Buffer.from(canonicalize(intent), "utf8");
  const payload_hash = sha256(bytes.toString("utf8"));
  const signature = sign(null, bytes, privateKey).toString("base64url");
  return {
    algorithm: OIP_SIGNATURE_ALGORITHM,
    ...metadata,
    payload_hash,
    signature,
  };
}

export function verifyIntentSignature(
  intent: Intent,
  envelope: SignatureEnvelope,
  publicKey: KeyObject,
  now = new Date(),
): VerificationResult {
  if (envelope.algorithm !== OIP_SIGNATURE_ALGORITHM) {
    return { valid: false, reason_code: "UNSUPPORTED_ALGORITHM" };
  }
  const issued = new Date(envelope.issued_at).getTime();
  const expires = new Date(envelope.expires_at).getTime();
  const current = now.getTime();
  if (current < issued) return { valid: false, reason_code: "SIGNATURE_NOT_YET_VALID" };
  if (current > expires) return { valid: false, reason_code: "SIGNATURE_EXPIRED" };

  const bytes = Buffer.from(canonicalize(intent), "utf8");
  if (sha256(bytes.toString("utf8")) !== envelope.payload_hash) {
    return { valid: false, reason_code: "PAYLOAD_MUTATED" };
  }
  const valid = verify(
    null,
    bytes,
    publicKey,
    Buffer.from(envelope.signature, "base64url"),
  );
  return valid ? { valid: true } : { valid: false, reason_code: "SIGNATURE_INVALID" };
}

export class ReplayGuard {
  private readonly seen = new Set<string>();

  consume(signer: string, nonce: string): boolean {
    const key = signer + ":" + nonce;
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }
}

export type CompositionNode = {
  id: string;
  intent: Intent;
  depends_on: string[];
  compensation_for?: string;
};

export function validateComposition(nodes: CompositionNode[], maxNodes = 100): {
  valid: boolean;
  reason_code?: "EMPTY_GRAPH" | "GRAPH_TOO_LARGE" | "DUPLICATE_NODE" | "MISSING_DEPENDENCY" | "CYCLE";
} {
  if (nodes.length === 0) return { valid: false, reason_code: "EMPTY_GRAPH" };
  if (nodes.length > maxNodes) return { valid: false, reason_code: "GRAPH_TOO_LARGE" };

  const ids = new Set<string>();
  for (const node of nodes) {
    if (ids.has(node.id)) return { valid: false, reason_code: "DUPLICATE_NODE" };
    ids.add(node.id);
  }
  for (const node of nodes) {
    for (const dependency of node.depends_on) {
      if (!ids.has(dependency)) return { valid: false, reason_code: "MISSING_DEPENDENCY" };
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const byId = new Map(nodes.map((node) => [node.id, node]));
  function visit(id: string): boolean {
    if (visiting.has(id)) return false;
    if (visited.has(id)) return true;
    visiting.add(id);
    for (const dependency of byId.get(id)?.depends_on ?? []) {
      if (!visit(dependency)) return false;
    }
    visiting.delete(id);
    visited.add(id);
    return true;
  }
  for (const node of nodes) {
    if (!visit(node.id)) return { valid: false, reason_code: "CYCLE" };
  }
  return { valid: true };
}

export interface CapabilityAdvertisement {
  advertisement_id: string;
  capability_id: string;
  provider_id: string;
  version: string;
  schemas: string[];
  channels: string[];
  required_features: string[];
  priority: number;
  expires_at: string;
  revoked?: boolean;
}

export interface CapabilityQuery {
  capability_id: string;
  min_version?: string;
  required_features?: string[];
  now?: Date;
}

export class CapabilityRegistry {
  private readonly advertisements = new Map<string, CapabilityAdvertisement>();

  advertise(advertisement: CapabilityAdvertisement): void {
    parseSemver(advertisement.version);
    if (new Date(advertisement.expires_at).getTime() <= Date.now()) {
      throw new Error("ADVERTISEMENT_EXPIRED");
    }
    this.advertisements.set(advertisement.advertisement_id, { ...advertisement });
  }

  withdraw(advertisementId: string): boolean {
    return this.advertisements.delete(advertisementId);
  }

  discover(query: CapabilityQuery): CapabilityAdvertisement[] {
    const now = (query.now ?? new Date()).getTime();
    return [...this.advertisements.values()]
      .filter((entry) =>
        !entry.revoked &&
        entry.capability_id === query.capability_id &&
        new Date(entry.expires_at).getTime() > now &&
        (!query.min_version || compareSemver(entry.version, query.min_version) >= 0) &&
        (query.required_features ?? []).every((feature) =>
          entry.required_features.includes(feature),
        ),
      )
      .sort((a, b) =>
        (a.priority - b.priority) ||
        compareSemver(b.version, a.version) ||
        a.provider_id.localeCompare(b.provider_id),
      );
  }
}

export type ExecutionState =
  | "accepted"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "expired";

const transitions: Record<ExecutionState, ExecutionState[]> = {
  accepted: ["running", "cancelled", "expired"],
  running: ["waiting", "succeeded", "failed", "cancelled", "expired"],
  waiting: ["running", "succeeded", "failed", "cancelled", "expired"],
  succeeded: [],
  failed: [],
  cancelled: [],
  expired: [],
};

export interface ExecutionRecord {
  execution_id: string;
  intent_id: string;
  idempotency_key: string;
  state: ExecutionState;
  sequence: number;
  created_at: string;
  updated_at: string;
  progress: number;
  last_error?: string;
}

export class ExecutionStore {
  private readonly executions = new Map<string, ExecutionRecord>();
  private readonly byIdempotencyKey = new Map<string, string>();
  private counter = 0;

  submit(intent: Intent, now = new Date()): ExecutionRecord {
    const key = intent.idempotency_key ?? intent.id;
    const existing = this.byIdempotencyKey.get(key);
    if (existing) return { ...this.executions.get(existing)! };

    this.counter += 1;
    const timestamp = now.toISOString();
    const record: ExecutionRecord = {
      execution_id: "exec_" + String(this.counter).padStart(8, "0"),
      intent_id: intent.id,
      idempotency_key: key,
      state: "accepted",
      sequence: 0,
      created_at: timestamp,
      updated_at: timestamp,
      progress: 0,
    };
    this.executions.set(record.execution_id, record);
    this.byIdempotencyKey.set(key, record.execution_id);
    return { ...record };
  }

  get(executionId: string): ExecutionRecord | undefined {
    const record = this.executions.get(executionId);
    return record ? { ...record } : undefined;
  }

  transition(
    executionId: string,
    state: ExecutionState,
    reason?: string,
    now = new Date(),
  ): ExecutionRecord {
    const record = this.executions.get(executionId);
    if (!record) throw new Error("EXECUTION_NOT_FOUND");
    if (!transitions[record.state].includes(state)) {
      throw new Error("INVALID_EXECUTION_TRANSITION");
    }
    record.state = state;
    record.sequence += 1;
    record.updated_at = now.toISOString();
    if (reason) record.last_error = reason;
    if (state === "succeeded") record.progress = 100;
    return { ...record };
  }

  reportProgress(executionId: string, progress: number, now = new Date()): ExecutionRecord {
    const record = this.executions.get(executionId);
    if (!record) throw new Error("EXECUTION_NOT_FOUND");
    if (!["running", "waiting"].includes(record.state)) {
      throw new Error("PROGRESS_ON_NON_ACTIVE_EXECUTION");
    }
    if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
      throw new Error("INVALID_PROGRESS");
    }
    record.progress = progress;
    record.sequence += 1;
    record.updated_at = now.toISOString();
    return { ...record };
  }
}

export interface AuditRecord {
  sequence: number;
  event_type: string;
  intent_id: string;
  actor: string;
  observed_at: string;
  data: JsonValue;
  previous_hash: string;
  hash: string;
}

export class AuditLog {
  private readonly records: AuditRecord[] = [];

  append(
    event_type: string,
    intent_id: string,
    actor: string,
    data: JsonValue,
    observed_at = new Date(),
  ): AuditRecord {
    const previous_hash = this.records.at(-1)?.hash ?? "GENESIS";
    const sequence = this.records.length + 1;
    const unsigned = {
      sequence,
      event_type,
      intent_id,
      actor,
      observed_at: observed_at.toISOString(),
      data,
      previous_hash,
    };
    const hash = sha256(canonicalize(unsigned));
    const record = { ...unsigned, hash };
    this.records.push(record);
    return { ...record };
  }

  verify(): boolean {
    let previous = "GENESIS";
    for (const record of this.records) {
      const unsigned = {
        sequence: record.sequence,
        event_type: record.event_type,
        intent_id: record.intent_id,
        actor: record.actor,
        observed_at: record.observed_at,
        data: record.data,
        previous_hash: record.previous_hash,
      };
      if (record.previous_hash !== previous || record.hash !== sha256(canonicalize(unsigned))) {
        return false;
      }
      previous = record.hash;
    }
    return true;
  }

  list(): AuditRecord[] {
    return JSON.parse(JSON.stringify(this.records)) as AuditRecord[];
  }
}

export interface AuthorityEnvelope {
  delegation?: {
    id: string;
    delegator: string;
    delegatee: string;
    audience: string;
    capabilities: string[];
    issued_at: string;
    expires_at: string;
    revoked?: boolean;
  };
  human_return?: {
    proof_id: string;
    subject: string;
    audience: string;
    intent_id: string;
    verified: boolean;
    expires_at: string;
  };
  policy: {
    require_human_return: boolean;
  };
}

export interface AuthorityCheckInput {
  intent_id: string;
  audience: string;
  delegatee: string;
  requested_capability: string;
  now?: Date;
  authority: AuthorityEnvelope;
}

export function validateH2A2HAuthority(input: AuthorityCheckInput): {
  accepted: boolean;
  reason_code?:
    | "DELEGATION_REQUIRED"
    | "DELEGATION_EXPIRED"
    | "DELEGATION_REVOKED"
    | "DELEGATION_AUDIENCE_MISMATCH"
    | "DELEGATION_SUBJECT_MISMATCH"
    | "CAPABILITY_OUTSIDE_DELEGATION"
    | "HUMAN_RETURN_REQUIRED"
    | "HUMAN_RETURN_INVALID"
    | "HUMAN_RETURN_EXPIRED";
} {
  const now = (input.now ?? new Date()).getTime();
  const delegation = input.authority.delegation;
  if (delegation) {
    if (delegation.revoked) return { accepted: false, reason_code: "DELEGATION_REVOKED" };
    if (new Date(delegation.expires_at).getTime() <= now) {
      return { accepted: false, reason_code: "DELEGATION_EXPIRED" };
    }
    if (delegation.audience !== input.audience) {
      return { accepted: false, reason_code: "DELEGATION_AUDIENCE_MISMATCH" };
    }
    if (delegation.delegatee !== input.delegatee) {
      return { accepted: false, reason_code: "DELEGATION_SUBJECT_MISMATCH" };
    }
    if (!delegation.capabilities.includes(input.requested_capability)) {
      return { accepted: false, reason_code: "CAPABILITY_OUTSIDE_DELEGATION" };
    }
  }

  if (input.authority.policy.require_human_return) {
    const proof = input.authority.human_return;
    if (!proof || !proof.verified) return { accepted: false, reason_code: "HUMAN_RETURN_INVALID" };
    if (proof.intent_id !== input.intent_id || proof.audience !== input.audience) {
      return { accepted: false, reason_code: "HUMAN_RETURN_INVALID" };
    }
    if (new Date(proof.expires_at).getTime() <= now) {
      return { accepted: false, reason_code: "HUMAN_RETURN_EXPIRED" };
    }
  }

  return { accepted: true };
}

export * from "./oec.js";
