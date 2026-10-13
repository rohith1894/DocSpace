package com.example.docspace.document.repository;

import com.example.docspace.document.entity.DocumentEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface DocumentRepository extends JpaRepository<DocumentEntity, UUID> {

    @Query("""
        SELECT d FROM DocumentEntity d
        WHERE d.ownerId = :userId
           OR d.id IN (SELECT p.documentId FROM DocumentPermissionEntity p WHERE p.userId = :userId)
        ORDER BY d.updatedAt DESC
    """)
    List<DocumentEntity> findAllAccessibleByUser(@Param("userId") UUID userId);

    /**
     * Content is merged by the CRDT, so concurrent saves are expected and must not conflict.
     * A bulk update bypasses the {@code @Version} check that guards title and sharing changes.
     */
    @Modifying(clearAutomatically = true)
    @Query("UPDATE DocumentEntity d SET d.content = :content, d.updatedAt = :updatedAt WHERE d.id = :id")
    void updateContent(@Param("id") UUID id, @Param("content") String content, @Param("updatedAt") Instant updatedAt);
}
