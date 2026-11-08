import * as crypto from "node:crypto";

type Argon2Parameters = {
  message: string;
  nonce: Buffer;
  parallelism: number;
  tagLength: number;
  memory: number;
  passes: number;
};

type Argon2Function = (
  algorithm: "argon2d" | "argon2i" | "argon2id",
  parameters: Argon2Parameters,
  callback: (error: Error | null, derivedKey: Buffer) => void
) => void;

// @types/node 22 does not expose the API added in Node 24.7 yet.
const deriveArgon2 = (crypto as unknown as { argon2: Argon2Function }).argon2;
const { randomBytes, timingSafeEqual } = crypto;

const DEFAULT_MEMORY = 65_536;
const DEFAULT_PASSES = 3;
const DEFAULT_PARALLELISM = 4;
const DEFAULT_TAG_LENGTH = 32;

type ParsedHash = {
  algorithm: "argon2d" | "argon2i" | "argon2id";
  memory: number;
  passes: number;
  parallelism: number;
  salt: Buffer;
  tag: Buffer;
};

function encodeBase64(value: Buffer): string {
  return value.toString("base64").replace(/=+$/u, "");
}

function parsePasswordHash(encoded: string): ParsedHash | null {
  const match = encoded.match(
    /^\$(argon2(?:d|i|id))\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/u
  );

  if (!match) return null;

  const [, algorithm, memoryText, passesText, parallelismText, saltText, tagText] = match;
  const memory = Number(memoryText);
  const passes = Number(passesText);
  const parallelism = Number(parallelismText);
  const salt = Buffer.from(saltText, "base64");
  const tag = Buffer.from(tagText, "base64");

  if (
    !Number.isSafeInteger(memory) ||
    !Number.isSafeInteger(passes) ||
    !Number.isSafeInteger(parallelism) ||
    memory < 8 * parallelism ||
    memory > 262_144 ||
    passes < 1 ||
    passes > 10 ||
    parallelism < 1 ||
    parallelism > 16 ||
    salt.length < 8 ||
    salt.length > 1024 ||
    tag.length < 4 ||
    tag.length > 1024
  ) {
    return null;
  }

  return {
    algorithm: algorithm as ParsedHash["algorithm"],
    memory,
    passes,
    parallelism,
    salt,
    tag,
  };
}

function derivePassword(
  password: string,
  parsed: Omit<ParsedHash, "algorithm"> & { algorithm?: ParsedHash["algorithm"] }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    deriveArgon2(
      parsed.algorithm ?? "argon2id",
      {
        message: password,
        nonce: parsed.salt,
        parallelism: parsed.parallelism,
        tagLength: parsed.tag.length,
        memory: parsed.memory,
        passes: parsed.passes,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      }
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const tag = await derivePassword(password, {
    salt,
    tag: Buffer.alloc(DEFAULT_TAG_LENGTH),
    memory: DEFAULT_MEMORY,
    passes: DEFAULT_PASSES,
    parallelism: DEFAULT_PARALLELISM,
  });

  return `$argon2id$v=19$m=${DEFAULT_MEMORY},t=${DEFAULT_PASSES},p=${DEFAULT_PARALLELISM}$${encodeBase64(salt)}$${encodeBase64(tag)}`;
}

export async function verifyPassword(
  encoded: string,
  password: string
): Promise<boolean> {
  const parsed = parsePasswordHash(encoded);
  if (!parsed) return false;

  const actual = await derivePassword(password, parsed);
  return actual.length === parsed.tag.length && timingSafeEqual(actual, parsed.tag);
}
