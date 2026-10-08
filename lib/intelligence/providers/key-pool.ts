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
    this.keys = this.keys.filter((k) => k !== key);
  }
}
