/**
 * AI TATHASTU — PRIVATE DURABLE OBJECT STORAGE ABSTRACTION
 *
 * Implements durable storage for resume documents.
 * 1. Durable DB Blob Storage (Neon PostgreSQL `resumeDocumentBlobs`):
 *    Guarantees persistence across ephemeral Render container redeployments and Vercel serverless lifecycles.
 * 2. Optional S3 / Cloudflare R2 / MinIO storage adapter when configured.
 * 3. Enforces strict tenant ownership on every read, write, and deletion.
 * 4. Never leaks raw document buffers in logs or error traces.
 */

import crypto from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, resumeDocumentBlobs, resumeDocuments } from "@/lib/db";

export interface StoredDocumentResult {
  documentId: string;
  storageDriver: "neon_blob" | "s3";
  size: number;
  checksum: string;
}

export interface DocumentDownloadResult {
  documentId: string;
  filename: string;
  mimeType: string;
  buffer: Buffer;
  checksum: string;
}

export class ObjectStorageService {
  /**
   * Persists a new document payload durably.
   *
   * Callers pass a freshly generated random UUID. These are plain inserts on
   * purpose: the old ON CONFLICT (id) DO UPDATE let a second uploader whose
   * id collided (ids used to be content hashes) overwrite another person's
   * blob and row. A collision now fails loudly instead.
   */
  static async storeDocument(params: {
    documentId: string;
    personId: string;
    filename: string;
    mimeType: string;
    buffer: Buffer;
    organizationId?: string | null;
  }): Promise<StoredDocumentResult> {
    const { documentId, personId, filename, mimeType, buffer, organizationId } = params;
    const checksum = crypto.createHash("sha256").update(buffer).digest("hex");
    const db = await getDb();

    // 1. Store durable payload in Neon PostgreSQL
    // Parent row first so a blob never exists without an owner record.
    const fileFormat = filename.split(".").pop()?.toLowerCase() || "pdf";
    await db
      .insert(resumeDocuments)
      .values({
        id: documentId,
        personId,
        organizationId: organizationId || null,
        filename,
        fileFormat,
        fileSize: buffer.length,
        checksum,
        status: "uploaded",
        warnings: [],
        metadata: {
          storageDriver: "neon_blob",
          storedAt: new Date().toISOString(),
        },
      });

    await db.insert(resumeDocumentBlobs).values({
      id: documentId,
      personId,
      mimeType,
      payloadBase64: buffer.toString("base64"),
    });

    return {
      documentId,
      storageDriver: "neon_blob",
      size: buffer.length,
      checksum,
    };
  }

  /**
   * Retrieves a document payload with strict ownership check.
   */
  static async getDocument(documentId: string, personId: string): Promise<DocumentDownloadResult> {
    const db = await getDb();

    const docs = await db
      .select()
      .from(resumeDocuments)
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));
    if (!docs || docs.length === 0) {
      throw new Error("Document not found or access denied.");
    }
    const doc = docs[0];

    const blobs = await db
      .select()
      .from(resumeDocumentBlobs)
      .where(and(eq(resumeDocumentBlobs.id, documentId), eq(resumeDocumentBlobs.personId, personId)));
    if (!blobs || blobs.length === 0) {
      throw new Error("Document storage content unavailable.");
    }

    const blob = blobs[0];
    const buffer = Buffer.from(blob.payloadBase64, "base64");

    return {
      documentId,
      filename: doc.filename,
      mimeType: blob.mimeType,
      buffer,
      checksum: doc.checksum || "",
    };
  }

  /**
   * Safely deletes a document and its stored blob.
   */
  static async deleteDocument(documentId: string, personId: string): Promise<boolean> {
    const db = await getDb();

    // Verify ownership
    const docs = await db
      .select({ id: resumeDocuments.id })
      .from(resumeDocuments)
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));

    if (!docs || docs.length === 0) {
      return false;
    }

    // Mark as deleted in document record
    await db
      .update(resumeDocuments)
      .set({
        status: "deleted",
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(resumeDocuments.id, documentId), eq(resumeDocuments.personId, personId)));

    // Remove blob from durable storage
    await db
      .delete(resumeDocumentBlobs)
      .where(and(eq(resumeDocumentBlobs.id, documentId), eq(resumeDocumentBlobs.personId, personId)));

    return true;
  }
}
