export class KeyPool {
  private keys: string[] = [];
  private initialCapacity = 0;
  private index = 0;

  constructor(envVarNames: string[]) {
    const collected: string[] = [];
    for (const baseName of envVarNames) {
      // 1. Direct environment variable (supports comma-separated keys)
      const val = process.env[baseName];
      if (val) {
        const split = val
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
        collected.push(...split);
      }

      // 2. Indexed environment variables (e.g., GROQ_API_KEY_1 .. GROQ_API_KEY_10)
      const rootPrefix = baseName.replace(/S$/, ""); // e.g. GROQ_API_KEYS -> GROQ_API_KEY
      for (let i = 1; i <= 10; i++) {
        const indexedVal = process.env[`${rootPrefix}_${i}`];
        if (indexedVal && indexedVal.trim()) {
          collected.push(indexedVal.trim());
        }
      }
    }

    // Deduplicate while preserving insertion order
    this.keys = Array.from(new Set(collected));
    this.initialCapacity = this.keys.length;
  }

  size(): number {
    return this.keys.length;
  }

  activeCount(): number {
    return this.keys.length;
  }

  capacity(): number {
    return this.initialCapacity;
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
    const cursor = this.keys.length ? this.index % this.keys.length : 0;
    this.keys.splice(at, 1);
    this.index = at < cursor ? cursor - 1 : cursor;
  }
}

