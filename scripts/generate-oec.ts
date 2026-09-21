import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import {
  declarationDigest,
  generateOecConformanceManifest,
  generateOecOpenApi,
  validateOecDeclaration,
  type OecDeclaration,
} from "../src/oec.js";

const inputPath = process.argv[2] ?? "examples/oec-user.json";
const outputDir = process.argv[3] ?? "generated";
const declaration = JSON.parse(await readFile(inputPath, "utf8")) as OecDeclaration;
const validation = validateOecDeclaration(declaration);
if (!validation.valid) {
  throw new Error(JSON.stringify(validation));
}
const stem = basename(inputPath, ".json");

await mkdir(outputDir, { recursive: true });
await writeFile(join(outputDir, `${stem}.openapi.json`), `${JSON.stringify(generateOecOpenApi(declaration), null, 2)}\n`);
await writeFile(join(outputDir, `${stem}.conformance.json`), `${JSON.stringify(generateOecConformanceManifest(declaration), null, 2)}\n`);
await writeFile(join(outputDir, `${stem}.declaration.sha256`), `${declarationDigest(declaration)}\n`);
