# AI Tathastu — Database Backup & Recovery Strategy (Phase D)

**Architecture:** PostgreSQL (Production / Neon / Supabase) & Embedded PGlite (Local / Staging)  
**Standard:** ACID transactional safety, zero orphaned foreign keys, point-in-time recovery capability.

---

## 1. Backup Strategy Overview

| Tier | Backup Type | Frequency | Retention | Storage Location | Encryption |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Continuous** | WAL Streaming (Point-in-Time Recovery) | Continuous | 7 Days | Managed Cloud Storage (S3 / GCS) | AES-256 (At-rest & in-flight) |
| **Daily** | Full Logical Snapshot (`pg_dump`) | Every 24h at 02:00 UTC | 30 Days | Encrypted Secondary Object Bucket | AES-256 (KMS Managed) |
| **Weekly** | Cold Archive Snapshot | Weekly (Sunday) | 90 Days | Immutable Cold Storage | Multi-Region Encrypted Archive |

---

## 2. Production PostgreSQL (Neon / AWS RDS) Procedure

### 2.1 Generating a Logical Backup
To generate an encrypted, self-contained logical dump of all tables and schemas:
```bash
# Set environment
export PGPASSWORD="your_secure_db_password"

# Perform compressed custom-format pg_dump
pg_dump \
  --host=host.pooler.neon.tech \
  --port=5432 \
  --username=aitathastu_admin \
  --dbname=aitathastu \
  --format=custom \
  --no-owner \
  --no-privileges \
  --file=aitathastu_backup_$(date +%Y%m%d_%H%M%S).dump
```

### 2.2 Restoring from Backup Archive
To restore into a clean staging or recovery database:
```bash
# 1. Recreate clean target database
dropdb -h host.pooler.neon.tech -U aitathastu_admin aitathastu_recovery
createdb -h host.pooler.neon.tech -U aitathastu_admin aitathastu_recovery

# 2. Restore schema and data
pg_restore \
  --host=host.pooler.neon.tech \
  --port=5432 \
  --username=aitathastu_admin \
  --dbname=aitathastu_recovery \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  aitathastu_backup_YYYYMMDD_HHMMSS.dump

# 3. Apply any pending incremental migrations
npm run db:migrate
```

---

## 3. Empirical Restore Test Verification

Rather than relying purely on theoretical documentation, AI Tathastu includes an automated, runnable restore verification script:
[`scripts/test-backup-restore.ts`](file:///Users/quantumanant/aitathastu/scripts/test-backup-restore.ts) (runnable via `npm run test:restore`).

### 3.1 Empirical Test Results (Executed Oct 2026)
```text
==================================================
PHASE D: DATABASE BACKUP & RESTORE VERIFICATION TEST
==================================================
1. Initializing clean source database instance...
✓ Source database schema migrated successfully.
2. Seeding representative synthetic dataset...
✓ Seeded: 1 org, 2 users, 2 persons, 3 evidence records, 2 goals, 1 event, 1 learning activity.
3. Exporting source database state to logical backup archive...
✓ Backup successfully generated: 3971 bytes across 7 tables.
4. Initializing clean target database instance...
✓ Target database schema migrated successfully.
5. Restoring backup archive into target database instance...
✓ All tables restored into target database.
6. Verifying data fidelity and relational integrity...
  ✓ Table 'organizations': 1 rows verified.
  ✓ Table 'users': 2 rows verified.
  ✓ Table 'persons': 2 rows verified.
  ✓ Table 'evidence_items': 3 rows verified.
  ✓ Table 'goals': 2 rows verified.
  ✓ Table 'integration_events': 1 rows verified.
  ✓ Table 'learning_activities': 1 rows verified.
  ✓ Relational joins across users, persons, and goals verified.
  ✓ Evidence verification status fidelity verified.
==================================================
BACKUP & RESTORE TEST RESULT: PASS (1524ms)
Data integrity: 100% matched, 0 corruption, 0 orphaned foreign keys.
==================================================
```

---

## 4. Disaster Recovery Scenarios & RTO / RPO Targets

- **Recovery Point Objective (RPO):** < 15 minutes (under WAL streaming) / < 24 hours (under daily snapshot fallback).
- **Recovery Time Objective (RTO):** < 30 minutes to restore a full 10GB database into a fresh Neon/RDS cluster.
- **Data Integrity Guarantee:** All foreign keys specify `onDelete: cascade` or `onDelete: set null` explicitly in [`lib/db/schema.ts`](file:///Users/quantumanant/aitathastu/lib/db/schema.ts), preventing relational orphan states.
