-- Rename documents tables to use doc_ prefix convention.
ALTER TABLE "document_folders" RENAME TO "doc_folders";
ALTER TABLE "documents" RENAME TO "doc_documents";
