package com.example.docspace.document.entity;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "document_permissions", uniqueConstraints = {
        @UniqueConstraint(name = "uq_doc_user", columnNames = {"document_id", "user_id"})
})
public class DocumentPermissionEntity {

    @Id
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "document_id", nullable = false)
    private UUID documentId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 20)
    private DocumentRole role;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    public DocumentPermissionEntity() {}

    public DocumentPermissionEntity(UUID id, UUID documentId, UUID userId, DocumentRole role, Instant createdAt) {
        this.id = id;
        this.documentId = documentId;
        this.userId = userId;
        this.role = role;
        this.createdAt = createdAt;
    }

    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public UUID getDocumentId() {
        return documentId;
    }

    public void setDocumentId(UUID documentId) {
        this.documentId = documentId;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public DocumentRole getRole() {
        return role;
    }

    public void setRole(DocumentRole role) {
        this.role = role;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }
}
