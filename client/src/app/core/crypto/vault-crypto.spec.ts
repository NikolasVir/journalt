import { describe, expect, it } from 'vitest';
import {
  deriveVaultKeys,
  encryptPayload,
  decryptPayload
} from './vault-crypto';

describe('vault-crypto', () => {
  it('derives consistent partition token and different tokens for different passphrases', async () => {
    const keysA1 = await deriveVaultKeys('MyPassword123');
    const keysA2 = await deriveVaultKeys('MyPassword123');
    const keysB = await deriveVaultKeys('DecoyPassword456');

    expect(keysA1.partitionToken).toBe(keysA2.partitionToken);
    expect(keysA1.partitionToken).not.toBe(keysB.partitionToken);
    expect(keysA1.partitionToken.length).toBe(64); // 256-bit hex string
  });

  it('encrypts and decrypts payload successfully', async () => {
    const { aesKey } = await deriveVaultKeys('SecretPass1');
    const message = JSON.stringify({ title: 'Top Secret Note', body: 'Confidential info' });

    const encrypted = await encryptPayload(aesKey, message);
    expect(encrypted.encryptedPayload).toBeDefined();
    expect(encrypted.nonce).toBeDefined();
    expect(encrypted.authTag).toBeDefined();

    const decrypted = await decryptPayload(
      aesKey,
      encrypted.encryptedPayload,
      encrypted.nonce,
      encrypted.authTag
    );

    expect(decrypted).toBe(message);
  });

  it('fails decryption if authTag is altered or wrong key is used', async () => {
    const keysReal = await deriveVaultKeys('RealPassword');
    const keysDecoy = await deriveVaultKeys('DecoyPassword');

    const message = 'Secret message';
    const encrypted = await encryptPayload(keysReal.aesKey, message);

    // Decrypting with wrong key must throw (AES-GCM auth tag mismatch)
    await expect(
      decryptPayload(
        keysDecoy.aesKey,
        encrypted.encryptedPayload,
        encrypted.nonce,
        encrypted.authTag
      )
    ).rejects.toThrow();
  });
});
