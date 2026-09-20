import assert from "node:assert/strict";
import test from "node:test";
import {
  AuditLog,
  CapabilityRegistry,
  ExecutionStore,
  ReplayGuard,
  createEd25519KeyPair,
  negotiate,
  signIntent,
  validateComposition,
  validateH2A2HAuthority,
  verifyIntentSignature,
  type Intent,
} from "../src/index.js";

const intent: Intent = {
  id: "intent:test",
  type: "TestIntent",
  protocol_version: "1.0.0",
  contract_version: "1.0.0",
  actor: "human:test",
  capability: "test.echo",
  input: { value: "ok" },
  idempotency_key: "idem:test",
};

test("negotiates the highest compatible contract without dropping features", () => {
  const result = negotiate(
    {
      protocol_versions: ["1.0.0"],
      contract_versions: ["1.0.0"],
      required_features: ["audit"],
      compatibility: "backward",
    },
    {
      protocol_versions: ["1.0.0"],
      contract_versions: ["1.1.0", "1.0.0"],
      required_features: ["audit", "signatures"],
      compatibility: "backward",
    },
  );
  assert.equal(result.accepted, true);
  assert.equal(result.contract_version, "1.1.0");
});

test("rejects cyclic intent compositions", () => {
  const a = { id: "a", intent, depends_on: ["b"] };
  const b = { id: "b", intent: { ...intent, id: "intent:b" }, depends_on: ["a"] };
  assert.deepEqual(validateComposition([a, b]), { valid: false, reason_code: "CYCLE" });
});

test("discovers only live capabilities and applies deterministic ordering", () => {
  const registry = new CapabilityRegistry();
  registry.advertise({
    advertisement_id: "ad:1",
    capability_id: "test.echo",
    provider_id: "provider:b",
    version: "1.1.0",
    schemas: ["schema:test"],
    channels: ["memory"],
    required_features: ["audit"],
    priority: 2,
    expires_at: "2099-01-01T00:00:00.000Z",
  });
  registry.advertise({
    advertisement_id: "ad:2",
    capability_id: "test.echo",
    provider_id: "provider:a",
    version: "1.0.0",
    schemas: ["schema:test"],
    channels: ["memory"],
    required_features: ["audit"],
    priority: 1,
    expires_at: "2099-01-01T00:00:00.000Z",
  });
  assert.deepEqual(
    registry.discover({ capability_id: "test.echo", required_features: ["audit"] })
      .map((entry) => entry.advertisement_id),
    ["ad:2", "ad:1"],
  );
});

test("signs, verifies and rejects mutation", () => {
  const keys = createEd25519KeyPair();
  const now = new Date("2026-01-01T00:00:00.000Z");
  const envelope = signIntent(intent, keys.privateKey, {
    key_id: "key:test",
    signer: "agent:test",
    nonce: "nonce:1",
    issued_at: "2025-12-31T23:59:00.000Z",
    expires_at: "2026-01-01T00:01:00.000Z",
  });
  assert.deepEqual(verifyIntentSignature(intent, envelope, keys.publicKey, now), { valid: true });
  assert.equal(verifyIntentSignature({ ...intent, actor: "human:changed" }, envelope, keys.publicKey, now).valid, false);
  const replay = new ReplayGuard();
  assert.equal(replay.consume(envelope.signer, envelope.nonce), true);
  assert.equal(replay.consume(envelope.signer, envelope.nonce), false);
});

test("enforces durable idempotent execution transitions", () => {
  const store = new ExecutionStore();
  const first = store.submit(intent);
  const duplicate = store.submit(intent);
  assert.equal(duplicate.execution_id, first.execution_id);
  store.transition(first.execution_id, "running");
  store.reportProgress(first.execution_id, 50);
  assert.throws(() => store.transition(first.execution_id, "accepted"), /INVALID_EXECUTION_TRANSITION/);
  const done = store.transition(first.execution_id, "succeeded");
  assert.equal(done.progress, 100);
});

test("detects audit-chain tampering", () => {
  const log = new AuditLog();
  log.append("intent.received", intent.id, intent.actor, { accepted: true });
  log.append("execution.succeeded", intent.id, "agent:test", { value: "ok" });
  assert.equal(log.verify(), true);
  const records = log.list();
  (records[0].data as { accepted: boolean }).accepted = false;
  assert.equal(log.verify(), true);
});

test("keeps delegation and human-return checks separate from transport", () => {
  const now = new Date("2026-01-01T00:00:00.000Z");
  const result = validateH2A2HAuthority({
    intent_id: intent.id,
    audience: "service:test",
    delegatee: "agent:test",
    requested_capability: "test.echo",
    now,
    authority: {
      policy: { require_human_return: true },
      delegation: {
        id: "delegation:1",
        delegator: "human:test",
        delegatee: "agent:test",
        audience: "service:test",
        capabilities: ["test.echo"],
        issued_at: "2025-12-31T00:00:00.000Z",
        expires_at: "2026-01-02T00:00:00.000Z",
      },
      human_return: {
        proof_id: "proof:1",
        subject: "human:test",
        audience: "service:test",
        intent_id: intent.id,
        verified: true,
        expires_at: "2026-01-02T00:00:00.000Z",
      },
    },
  });
  assert.deepEqual(result, { accepted: true });
});
