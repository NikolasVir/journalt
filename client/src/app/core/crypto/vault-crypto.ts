/**
 * Zero-knowledge client-side cryptography for JournalT Vault.
 * Uses Web Crypto API (SubtleCrypto) with PBKDF2 (SHA-256, 100,000 iterations)
 * and AES-256-GCM authenticated encryption.
 */

export interface VaultDerivedKeys {
  partitionToken: string;
  aesKey: CryptoKey;
}

export interface EncryptedResult {
  encryptedPayload: string;
  nonce: string;
  authTag: string;
}

export function arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export function arrayBufferToHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derives a deterministic partition token and AES-256-GCM key from the user's passphrase.
 * Uses PBKDF2 with SHA-256 and 100,000 iterations.
 */
export async function deriveVaultKeys(
  passphrase: string,
  userSalt = 'JournalT-Vault-Global-Salt-v1'
): Promise<VaultDerivedKeys> {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const masterKeyBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(userSalt),
      iterations: 100_000,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );

  const hmacKey = await crypto.subtle.importKey(
    'raw',
    masterKeyBits,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  // Partition Token (64-char hex string sent to server as blind namespace)
  const partitionBuffer = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    encoder.encode('JournalT-Vault-Partition-Namespace')
  );
  const partitionToken = arrayBufferToHex(partitionBuffer);

  // Data Encryption Key (AES-256-GCM key used only in memory)
  const encKeyBuffer = await crypto.subtle.sign(
    'HMAC',
    hmacKey,
    encoder.encode('JournalT-Vault-Data-Encryption')
  );

  const aesKey = await crypto.subtle.importKey(
    'raw',
    encKeyBuffer,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt']
  );

  return { partitionToken, aesKey };
}

/**
 * Encrypts a plaintext string into AES-256-GCM ciphertext, 96-bit nonce, and 128-bit auth tag.
 */
export async function encryptPayload(
  key: CryptoKey,
  plaintext: string
): Promise<EncryptedResult> {
  const encoder = new TextEncoder();
  const nonceBytes = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV

  const ciphertextWithTag = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonceBytes as unknown as BufferSource,
      tagLength: 128
    },
    key,
    encoder.encode(plaintext)
  );

  // Split ciphertext and 16-byte tag
  const totalLength = ciphertextWithTag.byteLength;
  const cipherBytes = new Uint8Array(ciphertextWithTag, 0, totalLength - 16);
  const tagBytes = new Uint8Array(ciphertextWithTag, totalLength - 16, 16);

  return {
    encryptedPayload: arrayBufferToBase64(cipherBytes),
    nonce: arrayBufferToBase64(nonceBytes),
    authTag: arrayBufferToBase64(tagBytes)
  };
}

/**
 * Decrypts an AES-256-GCM encrypted payload using the provided nonce and auth tag.
 * Throws an error if the key, ciphertext, or auth tag do not match.
 */
export async function decryptPayload(
  key: CryptoKey,
  encryptedPayload: string,
  nonce: string,
  authTag: string
): Promise<string> {
  const cipherBytes = base64ToArrayBuffer(encryptedPayload);
  const tagBytes = base64ToArrayBuffer(authTag);
  const nonceBytes = base64ToArrayBuffer(nonce);

  // Recombine cipher bytes and auth tag
  const combined = new Uint8Array(cipherBytes.length + tagBytes.length);
  combined.set(cipherBytes, 0);
  combined.set(tagBytes, cipherBytes.length);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: nonceBytes as unknown as BufferSource,
      tagLength: 128
    },
    key,
    combined as unknown as BufferSource
  );

  return new TextDecoder().decode(decryptedBuffer);
}
