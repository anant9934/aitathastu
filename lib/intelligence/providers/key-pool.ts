export class KeyPool {
  private keys: string[] = [];
  private initialCapacity = 0;
  private index = 0;

  constructor(envVarNames: string[]) {
    // Collect all candidate base prefixes (e.g. GROQ_API_KEYS -> GROQ_API_KEY and GROQ_API_KEYS)
    const prefixes = new Set<string>();
    for (const baseName of envVarNames) {
      prefixes.add(baseName);
      prefixes.add(baseName.replace(/S$/, ""));
    }

    // Check if primary indexed key (_1) is defined
    let hasPrimaryIndexed = false;
    for (const prefix of prefixes) {
      if (process.env[`${prefix}_1`]?.trim()) {
        hasPrimaryIndexed = true;
        break;
      }
    }

    const collected: string[] = [];

    if (hasPrimaryIndexed) {
      // Authoritative indexed credential configuration (prevents stale singular/plural aliases from mixing)
      for (const prefix of prefixes) {
        for (let i = 1; i <= 10; i++) {
          const val = process.env[`${prefix}_${i}`];
          if (val && val.trim()) {
            collected.push(val.trim());
          }
        }
      }
    } else {
      // Hybrid/legacy fallback: collect from direct env vars AND any trailing indexed keys
      for (const baseName of envVarNames) {
        const val = process.env[baseName];
        if (val) {
          const split = val
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean);
          collected.push(...split);
        }
      }
      for (const prefix of prefixes) {
        for (let i = 1; i <= 10; i++) {
          const val = process.env[`${prefix}_${i}`];
          if (val && val.trim()) {
            collected.push(val.trim());
          }
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

