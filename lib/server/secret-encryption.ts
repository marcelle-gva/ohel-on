import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ApiError } from "./supabase-admin";

function getKey() {
  const secret = process.env.OHEL_INTEGRATION_ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new ApiError(503, "Configure OHEL_INTEGRATION_ENCRYPTION_KEY no ambiente do servidor.");
  }
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("hex")}.${cipher.getAuthTag().toString("hex")}.${encrypted.toString("hex")}`;
}

export function decryptSecret(value: string) {
  const [version, ivHex, authTagHex, dataHex] = value.split(".");
  if (version !== "v1" || !ivHex || !authTagHex || !dataHex) {
    throw new ApiError(500, "A credencial criptografada está em formato inválido.");
  }
  try {
    const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
    return Buffer.concat([
      decipher.update(Buffer.from(dataHex, "hex")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new ApiError(500, "Não foi possível descriptografar a credencial da instância.");
  }
}
