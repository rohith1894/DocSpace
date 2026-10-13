package com.example.docspace.collaboration.model;

/**
 * Message sent from a browser to the collaboration server.
 *
 * @param type    UPDATE (incremental Yjs update), SNAPSHOT (compacted state) or PING
 * @param update  base64-encoded Yjs update (UPDATE / SNAPSHOT)
 * @param upToSeq highest log sequence the snapshot covers (SNAPSHOT only)
 */
public record ClientMessage(Type type, String update, Long upToSeq) {

    public enum Type {
        UPDATE,
        SNAPSHOT,
        PING
    }
}
