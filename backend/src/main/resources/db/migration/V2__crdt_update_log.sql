-- V2__crdt_update_log.sql
-- Order the Yjs update log so compaction can replace a prefix with a snapshot.

ALTER TABLE document_updates ADD COLUMN seq BIGINT NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_updates_doc;
CREATE INDEX idx_updates_doc_seq ON document_updates(document_id, seq);
