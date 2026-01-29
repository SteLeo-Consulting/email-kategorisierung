// =============================================================================
// Encryption Utilities for Email Kategorisierung System
// Uses AES-256-GCM for authenticated encryption
// =============================================================================

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

/**
 * Get encryption key from environment
 * The key should be 64 hex characters (32 bytes)
 */
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  if (key.length !== 64) {
    throw new Error('ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
  }
  return Buffer.from(key, 'hex');
}

/**
 * Encrypt a string using AES-256-GCM
 * Returns a base64-encoded string containing: salt + iv + authTag + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const salt = randomBytes(SALT_LENGTH);

  // Derive a unique key for this encryption using the salt
  const derivedKey = scryptSync(key, salt, 32);

  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);

  let ciphertext = cipher.update(plaintext, 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);

  const authTag = cipher.getAuthTag();

  // Combine all components: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, ciphertext]);

  return combined.toString('base64');
}

/**
 * Decrypt a base64-encoded encrypted string
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');

  // Extract components
  const salt = combined.subarray(0, SALT_LENGTH);
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

  // Derive the key using the same salt
  const derivedKey = scryptSync(key, salt, 32);

  const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
  decipher.setAuthTag(authTag);

  let plaintext = decipher.update(ciphertext);
  plaintext = Buffer.concat([plaintext, decipher.final()]);

  return plaintext.toString('utf8');
}

/**
 * Check if a string appears to be encrypted (base64 with expected length)
 */
export function isEncrypted(data: string): boolean {
  try {
    const decoded = Buffer.from(data, 'base64');
    // Minimum length: salt (32) + iv (16) + authTag (16) + at least 1 byte ciphertext
    return decoded.length >= SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH + 1;
  } catch {
    return false;
  }
}

/**
 * Generate a random encryption key (for setup purposes)
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a value for comparison (not reversible)
 * Useful for checking if a value changed without storing the original
 */
export function hashValue(value: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(value, salt, 32);
  return Buffer.concat([salt, hash]).toString('base64');
}

/**
 * Verify a value against its hash
 */
export function verifyHash(value: string, storedHash: string): boolean {
  try {
    const combined = Buffer.from(storedHash, 'base64');
    const salt = combined.subarray(0, 16);
    const originalHash = combined.subarray(16);
    const newHash = scryptSync(value, salt, 32);
    return originalHash.equals(newHash);
  } catch {
    return false;
  }
}
