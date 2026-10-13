package com.example.docspace.document.repository;

import com.example.docspace.document.entity.DocumentPermissionEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface DocumentPermissionRepository extends JpaRepository<DocumentPermissionEntity, UUID> {
    List<DocumentPermissionEntity> findByDocumentId(UUID documentId);
    Optional<DocumentPermissionEntity> findByDocumentIdAndUserId(UUID documentId, UUID userId);
    void deleteByDocumentIdAndUserId(UUID documentId, UUID userId);
    boolean existsByDocumentIdAndUserId(UUID documentId, UUID userId);
}
