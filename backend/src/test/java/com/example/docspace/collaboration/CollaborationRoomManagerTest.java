package com.example.docspace.collaboration;

import com.example.docspace.collaboration.model.CollaboratorIdentity;
import com.example.docspace.collaboration.model.ServerMessage;
import com.example.docspace.collaboration.persistence.DocumentUpdateStore;
import com.example.docspace.collaboration.persistence.LogOperation;
import com.example.docspace.collaboration.persistence.StoredUpdate;
import com.example.docspace.collaboration.service.CollaborationRoomManager;
import com.example.docspace.collaboration.service.MessageSender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.*;
import java.util.concurrent.*;
import java.util.stream.IntStream;

import static org.junit.jupiter.api.Assertions.*;

class CollaborationRoomManagerTest {

    private static final UUID DOC = UUID.randomUUID();
    private static final UUID ALICE = UUID.randomUUID();
    private static final UUID BOB = UUID.randomUUID();

    private InMemoryStore store;
    private ScheduledExecutorService executor;
    private CollaborationRoomManager manager;

    @BeforeEach
    void setUp() {
        store = new InMemoryStore();
        executor = Executors.newSingleThreadScheduledExecutor();
        manager = new CollaborationRoomManager(store, executor);
    }

    @AfterEach
    void tearDown() {
        executor.close();
    }

    @Test
    void firstEditorOfEmptyDocumentIsAskedToSeedExactlyOnce() {
        RecordingSender alice = join("a", ALICE, true);
        RecordingSender bob = join("b", BOB, true);

        assertTrue(alice.first(ServerMessage.Type.SYNC).needsSeed());
        assertFalse(bob.first(ServerMessage.Type.SYNC).needsSeed());
    }

    @Test
    void viewerIsNeverAskedToSeed() {
        RecordingSender viewer = join("v", BOB, false);
        RecordingSender editor = join("e", ALICE, true);

        assertFalse(viewer.first(ServerMessage.Type.SYNC).needsSeed());
        assertTrue(editor.first(ServerMessage.Type.SYNC).needsSeed());
    }

    @Test
    void seedClaimIsReleasedWhenClaimantLeavesWithoutSeeding() {
        join("a", ALICE, true);
        manager.leave("a");
        // Room was closed; open a second session while the first one is still around
        join("b", BOB, true);
        RecordingSender c = join("c", ALICE, true);
        manager.leave("b");
        RecordingSender d = join("d", ALICE, true);

        assertFalse(c.first(ServerMessage.Type.SYNC).needsSeed());
        assertTrue(d.first(ServerMessage.Type.SYNC).needsSeed());
    }

    @Test
    void updatesAreRelayedToPeersAndAcknowledgedToSender() {
        RecordingSender alice = join("a", ALICE, true);
        RecordingSender bob = join("b", BOB, true);

        manager.applyUpdate("a", b64("one"));

        ServerMessage relayed = bob.first(ServerMessage.Type.UPDATE);
        assertEquals(b64("one"), relayed.update());
        assertEquals(1L, relayed.seq());
        assertEquals(1L, alice.first(ServerMessage.Type.ACK).seq());
        assertTrue(alice.all(ServerMessage.Type.UPDATE).isEmpty(), "sender must not receive its own update");
    }

    @Test
    void lateJoinerReceivesFullOrderedLog() {
        join("a", ALICE, true);
        manager.applyUpdate("a", b64("one"));
        manager.applyUpdate("a", b64("two"));

        ServerMessage sync = join("b", BOB, true).first(ServerMessage.Type.SYNC);

        assertEquals(List.of(b64("one"), b64("two")), sync.updates());
        assertEquals(2L, sync.seq());
        assertFalse(sync.needsSeed());
    }

    @Test
    void viewerUpdatesAreRejected() {
        RecordingSender editor = join("e", ALICE, true);
        RecordingSender viewer = join("v", BOB, false);

        manager.applyUpdate("v", b64("hack"));

        assertEquals(ServerMessage.Type.ERROR, viewer.last().type());
        assertTrue(editor.all(ServerMessage.Type.UPDATE).isEmpty());
    }

    @Test
    void invalidPayloadIsRejected() {
        RecordingSender alice = join("a", ALICE, true);

        manager.applyUpdate("a", "%%%not-base64");

        assertEquals(ServerMessage.Type.ERROR, alice.last().type());
    }

    @Test
    void snapshotReplacesCoveredPrefixAndKeepsLaterUpdates() throws Exception {
        join("a", ALICE, true);
        manager.applyUpdate("a", b64("1"));
        manager.applyUpdate("a", b64("2"));
        manager.applyUpdate("a", b64("3"));

        manager.applySnapshot("a", b64("snap"), 2);
        flush();

        ServerMessage sync = join("b", BOB, true).first(ServerMessage.Type.SYNC);
        assertEquals(List.of(b64("snap"), b64("3")), sync.updates());
        assertEquals(3L, sync.seq());
        assertEquals(List.of(2L, 3L), store.seqs(DOC));
    }

    @Test
    void snapshotBeyondKnownSequenceIsIgnored() {
        join("a", ALICE, true);
        manager.applyUpdate("a", b64("1"));

        manager.applySnapshot("a", b64("snap"), 5);

        ServerMessage sync = join("b", BOB, true).first(ServerMessage.Type.SYNC);
        assertEquals(List.of(b64("1")), sync.updates());
    }

    @Test
    void roomReloadsPersistedLogAfterEveryoneLeft() {
        join("a", ALICE, true);
        manager.applyUpdate("a", b64("persisted"));
        manager.leave("a");

        ServerMessage sync = join("b", BOB, true).first(ServerMessage.Type.SYNC);

        assertEquals(List.of(b64("persisted")), sync.updates());
        assertEquals(1L, sync.seq());
    }

    @Test
    void membersAreDeduplicatedPerUserAndUpdatedOnLeave() {
        RecordingSender laptop = join("laptop", ALICE, true);
        join("phone", ALICE, true);
        join("tablet", BOB, true);

        List<ServerMessage.Member> members = laptop.last(ServerMessage.Type.MEMBERS).members();
        assertEquals(2, members.size());
        assertEquals(2, members.getFirst().connections());

        manager.leave("tablet");
        assertEquals(1, laptop.last(ServerMessage.Type.MEMBERS).members().size());
    }

    @Test
    void concurrentUpdatesGetUniqueGaplessSequenceNumbers() throws Exception {
        int clients = 8;
        int updatesPerClient = 50;
        List<RecordingSender> senders = IntStream.range(0, clients)
                .mapToObj(i -> join("s" + i, UUID.randomUUID(), true)).toList();

        try (ExecutorService pool = Executors.newFixedThreadPool(clients)) {
            for (int i = 0; i < clients; i++) {
                String session = "s" + i;
                pool.submit(() -> {
                    for (int n = 0; n < updatesPerClient; n++) manager.applyUpdate(session, b64(session + n));
                });
            }
        }
        flush();

        int total = clients * updatesPerClient;
        assertEquals(total, store.seqs(DOC).size());
        assertEquals(LongStreamRange.closed(1, total), store.seqs(DOC));
        // Every client sees every other client's update, strictly in sequence order
        for (RecordingSender s : senders) {
            List<Long> seen = new ArrayList<>();
            s.messages.stream()
                    .filter(m -> m.type() == ServerMessage.Type.UPDATE || m.type() == ServerMessage.Type.ACK)
                    .forEach(m -> seen.add(m.seq()));
            assertEquals(total, seen.size());
            assertEquals(seen.stream().sorted().toList(), seen);
        }
    }

    @Test
    void slowDatabaseNeverBlocksRejoinAndWritesAreBatched() throws Exception {
        store.gate = new CountDownLatch(1); // database stalls
        join("a", ALICE, true);
        for (int i = 0; i < 20; i++) manager.applyUpdate("a", b64("u" + i));
        manager.leave("a");

        // Room stays in memory while writes are pending, so rejoining is instant and complete
        ServerMessage sync = join("b", BOB, true).first(ServerMessage.Type.SYNC);
        assertEquals(20, sync.updates().size());

        store.gate.countDown();
        flush();
        flush();
        assertEquals(LongStreamRange.closed(1, 20), store.seqs(DOC));
        assertTrue(store.batchSizes.size() <= 2, "expected batched writes but got " + store.batchSizes);
    }

    @Test
    void failedWritesAreRetriedNotLost() throws Exception {
        store.failuresLeft = 1;
        join("a", ALICE, true);
        manager.applyUpdate("a", b64("important"));
        manager.leave("a");

        long deadline = System.currentTimeMillis() + 5_000;
        while (store.seqs(DOC).isEmpty() && System.currentTimeMillis() < deadline) Thread.sleep(50);

        assertEquals(List.of(1L), store.seqs(DOC));
    }

    @Test
    void roomIsReleasedOnceEmptyAndFlushed() throws Exception {
        join("a", ALICE, true);
        manager.applyUpdate("a", b64("x"));
        manager.leave("a");
        flush();
        flush();

        store.data().clear(); // a reload would now see an empty log
        assertTrue(join("b", BOB, true).first(ServerMessage.Type.SYNC).updates().isEmpty());
    }

    private RecordingSender join(String sessionId, UUID userId, boolean canEdit) {
        RecordingSender sender = new RecordingSender(sessionId);
        manager.join(sender, new CollaboratorIdentity(DOC, userId, "user-" + userId, canEdit));
        return sender;
    }

    private void flush() throws Exception {
        executor.submit(() -> {}).get(5, TimeUnit.SECONDS);
    }

    private static String b64(String s) {
        return Base64.getEncoder().encodeToString(s.getBytes());
    }

    private static final class LongStreamRange {
        static List<Long> closed(long from, long to) {
            List<Long> out = new ArrayList<>();
            for (long i = from; i <= to; i++) out.add(i);
            return out;
        }
    }

    static final class RecordingSender implements MessageSender {
        private final String id;
        final List<ServerMessage> messages = new CopyOnWriteArrayList<>();

        RecordingSender(String id) {
            this.id = id;
        }

        @Override
        public String id() {
            return id;
        }

        @Override
        public void send(ServerMessage message) {
            messages.add(message);
        }

        ServerMessage first(ServerMessage.Type type) {
            return all(type).stream().findFirst().orElseThrow(() -> new AssertionError("no " + type));
        }

        ServerMessage last(ServerMessage.Type type) {
            List<ServerMessage> all = all(type);
            if (all.isEmpty()) throw new AssertionError("no " + type);
            return all.getLast();
        }

        ServerMessage last() {
            return messages.getLast();
        }

        List<ServerMessage> all(ServerMessage.Type type) {
            return messages.stream().filter(m -> m.type() == type).toList();
        }
    }

    static class InMemoryStore implements DocumentUpdateStore {
        private final Map<UUID, List<StoredUpdate>> data = new ConcurrentHashMap<>();

        Map<UUID, List<StoredUpdate>> data() {
            return data;
        }

        final List<Integer> batchSizes = new CopyOnWriteArrayList<>();
        volatile CountDownLatch gate = new CountDownLatch(0);
        volatile int failuresLeft;

        @Override
        public List<StoredUpdate> load(UUID documentId) {
            return List.copyOf(data.getOrDefault(documentId, List.of()));
        }

        @Override
        public void apply(UUID documentId, List<LogOperation> operations) {
            try {
                gate.await();
            } catch (InterruptedException e) {
                throw new IllegalStateException(e);
            }
            if (failuresLeft > 0) {
                failuresLeft--;
                throw new IllegalStateException("database unavailable");
            }
            batchSizes.add(operations.size());
            List<StoredUpdate> log = data.computeIfAbsent(documentId, k -> new ArrayList<>());
            for (LogOperation op : operations) {
                switch (op) {
                    case LogOperation.Append(StoredUpdate u) -> log.add(u);
                    case LogOperation.Compact(StoredUpdate snap) -> {
                        log.removeIf(u -> u.seq() <= snap.seq());
                        log.addFirst(snap);
                    }
                }
            }
        }

        List<Long> seqs(UUID documentId) {
            return load(documentId).stream().map(StoredUpdate::seq).toList();
        }
    }
}
