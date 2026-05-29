-- Rename audit tables to use audit_ prefix convention.
ALTER TABLE "audit_logs" RENAME TO "audit_entries";
