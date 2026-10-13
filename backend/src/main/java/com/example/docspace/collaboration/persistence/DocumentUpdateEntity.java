package com.example.docspace.collaboration.persistence;

import jakarta.persistence.*;
import org.springframework.data.domain.Persistable;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_updates")
public class DocumentUpdateEntity implements Persistable<UUID> {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "document_id", nullable = false, updatable = false)
    private UUID documentId;

    @Column(name = "seq", nullable = false, updatable = false)
    private long seq;

    @Column(name = "update_payload", nullable = false, updatable = false)
    private byte[] payload;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    protected DocumentUpdateEntity() {}

    public DocumentUpdateEntity(UUID documentId, long seq, byte[] payload) {
        this.id = UUID.randomUUID();
        this.documentId = documentId;
        this.seq = seq;
        this.payload = payload;
        this.createdAt = Instant.now();
    }

    @Override
    public UUID getId() {
        return id;
    }

    /** Log entries are insert-only, so skip the existence check Spring Data would otherwise run. */
    @Override
    public boolean isNew() {
        return true;
    }

    public long getSeq() {
        return seq;
    }

    public byte[] getPayload() {
        return payload;
    }
}
