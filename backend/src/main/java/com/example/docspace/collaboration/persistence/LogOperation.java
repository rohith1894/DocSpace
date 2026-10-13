package com.example.docspace.collaboration.persistence;

/** A change to a document's update log, queued for durable storage. */
public sealed interface LogOperation {

    record Append(StoredUpdate update) implements LogOperation {}

    /** Replace every entry with {@code seq <= snapshot.seq()} by the snapshot. */
    record Compact(StoredUpdate snapshot) implements LogOperation {}
}
