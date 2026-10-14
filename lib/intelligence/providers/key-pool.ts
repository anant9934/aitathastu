export class KeyPool {
  private keys: string[] = [];
  private index = 0;

  constructor(envVarNames: string[]) {
    for (const name of envVarNames) {
      const val = process.env[name];
      if (val) {
        const split = val
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        this.keys.push(...split);
      }
    }
  }

  size(): number {
    return this.keys.length;
  }

  hasKeys(): boolean {
    return this.keys.length > 0;
  }

  getNextKey(): string | null {
    if (this.keys.length === 0) return null;
    const key = this.keys[this.index % this.keys.length];
    this.index++;
    return key;
  }

  markKeyFailed(key: string): void {
    const at = this.keys.indexOf(key);
    if (at < 0) return;
    // Keep the cursor on the key that followed the removed one; without this
    // the key after a revoked one was silently skipped.
    const cursor = this.keys.length ? this.index % this.keys.length : 0;
    this.keys.splice(at, 1);
    this.index = at < cursor ? cursor - 1 : cursor;
  }
}
