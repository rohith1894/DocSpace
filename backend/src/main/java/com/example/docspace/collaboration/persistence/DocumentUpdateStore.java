package com.example.docspace.collaboration.persistence;

import java.util.List;
import java.util.UUID;

/** Durable storage for a document's ordered Yjs update log. */
public interface DocumentUpdateStore {

    /** Returns the whole log ordered by sequence. */
    List<StoredUpdate> load(UUID documentId);

    /** Applies the operations in order, atomically. */
    void apply(UUID documentId, List<LogOperation> operations);
}
