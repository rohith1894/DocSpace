package com.example.docspace.collaboration.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface DocumentUpdateRepository extends JpaRepository<DocumentUpdateEntity, UUID> {

    List<DocumentUpdateEntity> findByDocumentIdOrderBySeqAsc(UUID documentId);

    @Modifying
    @Query("delete from DocumentUpdateEntity u where u.documentId = :documentId and u.seq <= :seq")
    void deleteUpToSeq(@Param("documentId") UUID documentId, @Param("seq") long seq);
}
