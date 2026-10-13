package com.example.docspace.collaboration.service;

import com.example.docspace.collaboration.model.CollaboratorIdentity;
import com.example.docspace.collaboration.model.ServerMessage;
import com.example.docspace.collaboration.persistence.LogOperation;
import com.example.docspace.collaboration.persistence.StoredUpdate;

import java.util.*;

/**
 * In-memory state of one document's collaboration session.
 * Not thread-safe: {@link CollaborationRoomManager} guards every access with the room's monitor.
 */
final class DocumentRoom {

    private final UUID documentId;
    private final List<StoredUpdate> log = new ArrayList<>();
    private final Map<String, Participant> participants = new LinkedHashMap<>();
    /** Log changes not yet written to the database, in order. */
    private final List<LogOperation> unflushed = new ArrayList<>();
    private boolean flushScheduled;
    private long seq;
    private boolean loaded;
    private boolean closed;
    /** Session allowed to seed an empty log from the legacy HTML content. */
    private String seedClaimant;

    record Participant(MessageSender sender, CollaboratorIdentity identity) {}

    DocumentRoom(UUID documentId) {
        this.documentId = documentId;
    }

    UUID documentId() {
        return documentId;
    }

    boolean isLoaded() {
        return loaded;
    }

    void load(List<StoredUpdate> stored) {
        log.clear();
        log.addAll(stored);
        seq = stored.isEmpty() ? 0 : stored.getLast().seq();
        loaded = true;
    }

    boolean isClosed() {
        return closed;
    }

    void close() {
        closed = true;
    }

    long seq() {
        return seq;
    }

    int logSize() {
        return log.size();
    }

    List<StoredUpdate> log() {
        return List.copyOf(log);
    }

    void addParticipant(Participant participant) {
        participants.put(participant.sender().id(), participant);
    }

    Optional<Participant> removeParticipant(String sessionId) {
        if (sessionId.equals(seedClaimant)) {
            seedClaimant = null;
        }
        return Optional.ofNullable(participants.remove(sessionId));
    }

    Optional<Participant> participant(String sessionId) {
        return Optional.ofNullable(participants.get(sessionId));
    }

    Collection<Participant> participants() {
        return participants.values();
    }

    boolean isEmpty() {
        return participants.isEmpty();
    }

    /** Queues a write; returns true when the caller must schedule a flush. */
    boolean queueWrite(LogOperation operation) {
        unflushed.add(operation);
        if (flushScheduled) return false;
        flushScheduled = true;
        return true;
    }

    List<LogOperation> drainWrites() {
        List<LogOperation> batch = List.copyOf(unflushed);
        unflushed.clear();
        return batch;
    }

    /** Puts a failed batch back in front of anything queued meanwhile. */
    void requeueWrites(List<LogOperation> batch) {
        unflushed.addAll(0, batch);
    }

    boolean hasUnflushedWrites() {
        return !unflushed.isEmpty();
    }

    void flushFinished() {
        flushScheduled = false;
    }

    /** A room may only be dropped once nobody is connected and every write reached the database. */
    boolean isIdle() {
        return participants.isEmpty() && !flushScheduled;
    }

    /**
     * Grants the seed right to the first editor that joins a document with an empty log,
     * so legacy HTML content is converted to CRDT state exactly once.
     */
    boolean claimSeed(Participant participant) {
        if (!log.isEmpty() || seedClaimant != null || !participant.identity().canEdit()) {
            return false;
        }
        seedClaimant = participant.sender().id();
        return true;
    }

    StoredUpdate append(byte[] payload) {
        StoredUpdate update = new StoredUpdate(++seq, payload);
        log.add(update);
        seedClaimant = null;
        return update;
    }

    /**
     * Replaces the log prefix up to {@code upToSeq} with a snapshot.
     * Returns empty when the snapshot does not cover anything that is still in the log.
     */
    Optional<StoredUpdate> compact(byte[] snapshot, long upToSeq) {
        if (upToSeq > seq || log.isEmpty() || upToSeq < log.getFirst().seq()) {
            return Optional.empty();
        }
        log.removeIf(u -> u.seq() <= upToSeq);
        StoredUpdate compacted = new StoredUpdate(upToSeq, snapshot);
        log.addFirst(compacted);
        return Optional.of(compacted);
    }

    /** Distinct users in the room; a user with a laptop and a phone open counts once. */
    List<ServerMessage.Member> members() {
        Map<UUID, ServerMessage.Member> byUser = new LinkedHashMap<>();
        for (Participant p : participants.values()) {
            CollaboratorIdentity id = p.identity();
            byUser.merge(id.userId(),
                    new ServerMessage.Member(id.userId().toString(), id.name(), 1),
                    (a, b) -> new ServerMessage.Member(a.userId(), a.name(), a.connections() + 1));
        }
        return List.copyOf(byUser.values());
    }
}
