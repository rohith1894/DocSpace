package com.example.docspace.collaboration.service;

import com.example.docspace.collaboration.model.CollaboratorIdentity;
import com.example.docspace.collaboration.model.ServerMessage;
import com.example.docspace.collaboration.persistence.DocumentUpdateStore;
import com.example.docspace.collaboration.persistence.LogOperation;
import com.example.docspace.collaboration.persistence.StoredUpdate;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Service;

import java.util.Base64;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Coordinates collaboration rooms.
 *
 * <p>Each document has an ordered log of Yjs updates. Clients receive the full log on join and
 * every later update in order, so all replicas converge regardless of network timing.</p>
 *
 * <p>The database is written behind the live session: each room queues its log changes and a
 * background worker writes everything queued so far in one transaction. A room stays in memory
 * until its queue is empty, so a document is only ever (re)loaded from the database when the
 * database is complete; failed writes are retried rather than dropped.</p>
 */
@Service
public class CollaborationRoomManager {

    private static final Logger log = LoggerFactory.getLogger(CollaborationRoomManager.class);
    static final int MAX_UPDATE_BYTES = 1024 * 1024;
    private static final long RETRY_DELAY_MS = 2_000;

    private final Map<UUID, DocumentRoom> rooms = new ConcurrentHashMap<>();
    private final Map<String, DocumentRoom> roomBySession = new ConcurrentHashMap<>();
    private final DocumentUpdateStore store;
    private final ScheduledExecutorService persistenceExecutor;

    public CollaborationRoomManager(DocumentUpdateStore store,
                                    @Qualifier("collaborationPersistenceExecutor") ScheduledExecutorService persistenceExecutor) {
        this.store = store;
        this.persistenceExecutor = persistenceExecutor;
    }

    public void join(MessageSender sender, CollaboratorIdentity identity) {
        while (true) {
            DocumentRoom room = rooms.computeIfAbsent(identity.documentId(), DocumentRoom::new);
            synchronized (room) {
                if (room.isClosed()) {
                    continue; // raced with the last participant leaving; retry with a fresh room
                }
                if (!room.isLoaded()) {
                    room.load(store.load(identity.documentId()));
                }
                DocumentRoom.Participant participant = new DocumentRoom.Participant(sender, identity);
                room.addParticipant(participant);
                roomBySession.put(sender.id(), room);

                List<String> updates = room.log().stream().map(u -> encode(u.payload())).toList();
                sender.send(ServerMessage.sync(updates, room.seq(), room.claimSeed(participant), identity.canEdit()));
                broadcastMembers(room);
                log.info("{} joined document {} ({} connections)",
                        identity.name(), identity.documentId(), room.participants().size());
                return;
            }
        }
    }

    public void applyUpdate(String sessionId, String base64Update) {
        DocumentRoom room = roomBySession.get(sessionId);
        if (room == null) return;
        byte[] payload = decode(base64Update);

        synchronized (room) {
            DocumentRoom.Participant sender = room.participant(sessionId).orElse(null);
            if (sender == null) return;
            if (!sender.identity().canEdit()) {
                sender.sender().send(ServerMessage.error("You only have view access to this document"));
                return;
            }
            if (payload == null) {
                sender.sender().send(ServerMessage.error("Invalid update payload"));
                return;
            }

            StoredUpdate stored = room.append(payload);
            ServerMessage relay = ServerMessage.update(base64Update, stored.seq());
            for (DocumentRoom.Participant p : room.participants()) {
                if (p != sender) p.sender().send(relay);
            }
            sender.sender().send(ServerMessage.ack(stored.seq(), room.logSize()));
            queueWrite(room, new LogOperation.Append(stored));
        }
    }

    public void applySnapshot(String sessionId, String base64Snapshot, long upToSeq) {
        DocumentRoom room = roomBySession.get(sessionId);
        if (room == null) return;
        byte[] payload = decode(base64Snapshot);
        if (payload == null) return;

        synchronized (room) {
            boolean canEdit = room.participant(sessionId).map(p -> p.identity().canEdit()).orElse(false);
            if (!canEdit) return;
            room.compact(payload, upToSeq).ifPresent(snapshot -> {
                log.debug("Compacted document {} up to seq {}", room.documentId(), upToSeq);
                queueWrite(room, new LogOperation.Compact(snapshot));
            });
        }
    }

    public void leave(String sessionId) {
        DocumentRoom room = roomBySession.remove(sessionId);
        if (room == null) return;

        synchronized (room) {
            room.removeParticipant(sessionId).ifPresent(p ->
                    log.info("{} left document {}", p.identity().name(), room.documentId()));
            if (!closeIfIdle(room)) {
                broadcastMembers(room);
            }
        }
    }

    public void pong(String sessionId) {
        DocumentRoom room = roomBySession.get(sessionId);
        if (room == null) return;
        synchronized (room) {
            room.participant(sessionId).ifPresent(p -> p.sender().send(ServerMessage.pong()));
        }
    }

    int connectionCount(UUID documentId) {
        DocumentRoom room = rooms.get(documentId);
        if (room == null) return 0;
        synchronized (room) {
            return room.participants().size();
        }
    }

    private void broadcastMembers(DocumentRoom room) {
        ServerMessage members = ServerMessage.members(room.members());
        room.participants().forEach(p -> p.sender().send(members));
    }

    /** Must be called while holding the room's monitor. */
    private void queueWrite(DocumentRoom room, LogOperation operation) {
        if (room.queueWrite(operation)) {
            persistenceExecutor.execute(() -> flush(room));
        }
    }

    private void flush(DocumentRoom room) {
        List<LogOperation> batch;
        synchronized (room) {
            batch = room.drainWrites();
        }
        try {
            if (!batch.isEmpty()) store.apply(room.documentId(), batch);
        } catch (RuntimeException e) {
            log.error("Failed to persist {} log operations for document {}; retrying",
                    batch.size(), room.documentId(), e);
            synchronized (room) {
                room.requeueWrites(batch);
            }
            persistenceExecutor.schedule(() -> flush(room), RETRY_DELAY_MS, TimeUnit.MILLISECONDS);
            return;
        }
        synchronized (room) {
            if (room.hasUnflushedWrites()) {
                persistenceExecutor.execute(() -> flush(room)); // more arrived while writing
            } else {
                room.flushFinished();
                closeIfIdle(room);
            }
        }
    }

    /** Must be called while holding the room's monitor. */
    private boolean closeIfIdle(DocumentRoom room) {
        if (!room.isIdle()) return false;
        room.close();
        rooms.remove(room.documentId(), room);
        return true;
    }

    /** Writes whatever is still queued before the application stops, on the persistence thread to keep order. */
    @PreDestroy
    void flushAll() throws InterruptedException {
        try {
            persistenceExecutor.submit(() -> rooms.values().forEach(this::flush)).get(30, TimeUnit.SECONDS);
        } catch (ExecutionException | TimeoutException e) {
            log.error("Could not flush collaboration log on shutdown", e);
        }
    }

    private static String encode(byte[] bytes) {
        return Base64.getEncoder().encodeToString(bytes);
    }

    private static byte[] decode(String base64) {
        if (base64 == null || base64.isEmpty()) return null;
        try {
            byte[] bytes = Base64.getDecoder().decode(base64);
            return bytes.length == 0 || bytes.length > MAX_UPDATE_BYTES ? null : bytes;
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
