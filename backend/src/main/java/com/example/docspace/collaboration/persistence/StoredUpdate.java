package com.example.docspace.collaboration.persistence;

/**
 * One entry of a document's Yjs update log.
 * A compacted snapshot is stored as a single entry whose {@code seq} is the last sequence it covers.
 */
public record StoredUpdate(long seq, byte[] payload) {}
