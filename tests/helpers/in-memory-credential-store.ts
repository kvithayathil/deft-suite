import type { CredentialStore } from '../../src/core/ports/credential-store.js';

export class InMemoryCredentialStore implements CredentialStore {
  private store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }
}
