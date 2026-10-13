package com.example.docspace.document.service;

import com.example.docspace.auth.entity.UserEntity;
import com.example.docspace.auth.repository.UserRepository;
import com.example.docspace.common.exception.OptimisticLockConflictException;
import com.example.docspace.common.exception.ResourceNotFoundException;
import com.example.docspace.common.exception.UnauthorizedAccessException;
import com.example.docspace.document.dto.*;
import com.example.docspace.document.entity.DocumentEntity;
import com.example.docspace.document.entity.DocumentPermissionEntity;
import com.example.docspace.document.entity.DocumentRole;
import com.example.docspace.document.repository.DocumentPermissionRepository;
import com.example.docspace.document.repository.DocumentRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final DocumentPermissionRepository permissionRepository;
    private final UserRepository userRepository;

    public DocumentService(DocumentRepository documentRepository,
                           DocumentPermissionRepository permissionRepository,
                           UserRepository userRepository) {
        this.documentRepository = documentRepository;
        this.permissionRepository = permissionRepository;
        this.userRepository = userRepository;
    }

    @Transactional(readOnly = true)
    public List<DocumentSummaryDto> getDocuments(UUID userId) {
        List<DocumentEntity> documents = documentRepository.findAllAccessibleByUser(userId);
        return documents.stream().map(doc -> {
            DocumentRole role = resolveUserRole(doc, userId);
            String ownerEmail = userRepository.findById(doc.getOwnerId())
                    .map(UserEntity::getEmail)
                    .orElse("unknown");
            return new DocumentSummaryDto(
                    doc.getId(),
                    doc.getTitle(),
                    doc.getOwnerId(),
                    ownerEmail,
                    doc.getCreatedAt(),
                    doc.getUpdatedAt(),
                    doc.getMetadataVersion(),
                    role
            );
        }).toList();
    }

    @Transactional(readOnly = true)
    public DocumentDetailDto getDocumentById(UUID documentId, UUID userId) {
        DocumentEntity doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        DocumentRole currentUserRole = resolveUserRole(doc, userId);
        if (currentUserRole == null) {
            throw new UnauthorizedAccessException("You do not have permission to view this document");
        }

        String ownerEmail = userRepository.findById(doc.getOwnerId())
                .map(UserEntity::getEmail)
                .orElse("unknown");

        List<DocumentPermissionEntity> permissionEntities = permissionRepository.findByDocumentId(documentId);
        List<PermissionDto> permissions = new ArrayList<>();

        // Add owner to permissions list
        userRepository.findById(doc.getOwnerId()).ifPresent(owner ->
                permissions.add(new PermissionDto(owner.getId(), owner.getEmail(), owner.getName(), DocumentRole.OWNER))
        );

        // Add all collaborators
        for (DocumentPermissionEntity p : permissionEntities) {
            userRepository.findById(p.getUserId()).ifPresent(user ->
                    permissions.add(new PermissionDto(user.getId(), user.getEmail(), user.getName(), p.getRole()))
            );
        }

        return new DocumentDetailDto(
                doc.getId(),
                doc.getTitle(),
                doc.getContent(),
                doc.getOwnerId(),
                ownerEmail,
                doc.getCreatedAt(),
                doc.getUpdatedAt(),
                doc.getMetadataVersion(),
                currentUserRole,
                permissions
        );
    }

    @Transactional
    public DocumentSummaryDto createDocument(UUID userId, CreateDocumentRequest request) {
        UUID docId = UUID.randomUUID();
        String title = (request != null && request.title() != null && !request.title().isBlank())
                ? request.title().trim()
                : "Untitled document";

        Instant now = Instant.now();
        DocumentEntity doc = new DocumentEntity(
                docId,
                title,
                "<p></p>",
                userId,
                now,
                now
        );

        DocumentEntity saved = documentRepository.saveAndFlush(doc);

        String userEmail = userRepository.findById(userId).map(UserEntity::getEmail).orElse("unknown");
        return new DocumentSummaryDto(
                saved.getId(),
                saved.getTitle(),
                saved.getOwnerId(),
                userEmail,
                saved.getCreatedAt(),
                saved.getUpdatedAt(),
                saved.getMetadataVersion(),
                DocumentRole.OWNER
        );
    }

    @Transactional
    public DocumentSummaryDto updateTitle(UUID documentId, UUID userId, UpdateTitleRequest request) {
        DocumentEntity doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        DocumentRole role = resolveUserRole(doc, userId);
        if (role == null || role == DocumentRole.VIEWER) {
            throw new UnauthorizedAccessException("Viewers cannot rename documents");
        }

        // Concurrency Check: Explicit Optimistic Lock verification
        if (request.expectedVersion() != null && !request.expectedVersion().equals(doc.getMetadataVersion())) {
            throw new OptimisticLockConflictException(
                    "Conflict: Document was modified by another collaborator. Expected version: " +
                            request.expectedVersion() + ", current version: " + doc.getMetadataVersion()
            );
        }

        doc.setTitle(request.title().trim());
        doc.setUpdatedAt(Instant.now());
        DocumentEntity updated = documentRepository.saveAndFlush(doc);

        String ownerEmail = userRepository.findById(doc.getOwnerId()).map(UserEntity::getEmail).orElse("unknown");
        return new DocumentSummaryDto(
                updated.getId(),
                updated.getTitle(),
                updated.getOwnerId(),
                ownerEmail,
                updated.getCreatedAt(),
                updated.getUpdatedAt(),
                updated.getMetadataVersion(),
                role
        );
    }

    @Transactional
    public void saveContent(UUID documentId, UUID userId, SaveContentRequest request) {
        DocumentEntity doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        DocumentRole role = resolveUserRole(doc, userId);
        if (role == null || role == DocumentRole.VIEWER) {
            throw new UnauthorizedAccessException("Viewers cannot edit document content");
        }

        documentRepository.updateContent(documentId, request.content(), Instant.now());
    }

    @Transactional
    public void deleteDocument(UUID documentId, UUID userId) {
        DocumentEntity doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (!doc.getOwnerId().equals(userId)) {
            throw new UnauthorizedAccessException("Only the owner can delete this document");
        }

        documentRepository.delete(doc);
    }

    @Transactional
    public PermissionDto shareDocument(UUID documentId, UUID userId, ShareDocumentRequest request) {
        DocumentEntity doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (!doc.getOwnerId().equals(userId)) {
            throw new UnauthorizedAccessException("Only the owner can share this document");
        }

        UserEntity targetUser = userRepository.findByEmail(request.email().toLowerCase().trim())
                .orElseThrow(() -> new ResourceNotFoundException("User not found with email: " + request.email()));

        if (targetUser.getId().equals(userId)) {
            throw new IllegalArgumentException("Cannot share document with yourself (you are the owner)");
        }

        Optional<DocumentPermissionEntity> existing =
                permissionRepository.findByDocumentIdAndUserId(documentId, targetUser.getId());

        DocumentPermissionEntity permission;
        if (existing.isPresent()) {
            permission = existing.get();
            permission.setRole(request.role());
        } else {
            permission = new DocumentPermissionEntity(
                    UUID.randomUUID(),
                    documentId,
                    targetUser.getId(),
                    request.role(),
                    Instant.now()
            );
        }

        permissionRepository.save(permission);
        return new PermissionDto(targetUser.getId(), targetUser.getEmail(), targetUser.getName(), permission.getRole());
    }

    @Transactional
    public void removePermission(UUID documentId, UUID userId, UUID targetUserId) {
        DocumentEntity doc = documentRepository.findById(documentId)
                .orElseThrow(() -> new ResourceNotFoundException("Document not found: " + documentId));

        if (!doc.getOwnerId().equals(userId)) {
            throw new UnauthorizedAccessException("Only the owner can modify permissions");
        }

        permissionRepository.deleteByDocumentIdAndUserId(documentId, targetUserId);
    }

    @Transactional(readOnly = true)
    public Optional<DocumentRole> findUserRole(UUID documentId, UUID userId) {
        return documentRepository.findById(documentId).map(doc -> resolveUserRole(doc, userId));
    }

    @Transactional(readOnly = true)
    public boolean exists(UUID documentId) {
        return documentRepository.existsById(documentId);
    }

    public DocumentRole resolveUserRole(DocumentEntity doc, UUID userId) {
        if (doc.getOwnerId().equals(userId)) {
            return DocumentRole.OWNER;
        }
        return permissionRepository.findByDocumentIdAndUserId(doc.getId(), userId)
                .map(DocumentPermissionEntity::getRole)
                .orElse(null);
    }
}
