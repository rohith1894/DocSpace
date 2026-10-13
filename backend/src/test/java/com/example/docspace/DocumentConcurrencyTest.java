package com.example.docspace;

import com.example.docspace.auth.dto.RegisterRequest;
import com.example.docspace.auth.service.AuthService;
import com.example.docspace.common.exception.OptimisticLockConflictException;
import com.example.docspace.document.dto.CreateDocumentRequest;
import com.example.docspace.document.dto.DocumentSummaryDto;
import com.example.docspace.document.dto.UpdateTitleRequest;
import com.example.docspace.document.service.DocumentService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest
class DocumentConcurrencyTest {

    @Autowired
    private DocumentService documentService;

    @Autowired
    private AuthService authService;

    @Test
    @DisplayName("Optimistic Locking catches conflicting concurrent document updates")
    void testOptimisticLockingConcurrencyConflict() {
        // 1. Create a test user
        String email = "concurrency.test." + System.currentTimeMillis() + "@example.com";
        var authResponse = authService.register(new RegisterRequest(email, "Tester", "password123"));
        UUID userId = authResponse.user().id();

        // 2. Create a test document
        DocumentSummaryDto created = documentService.createDocument(userId, new CreateDocumentRequest("Initial Title"));
        assertNotNull(created.metadataVersion(), "Initial metadata version should be populated");
        Long initialVersion = created.metadataVersion();
        UUID docId = created.id();

        // 3. First user successfully renames title with the matching expectedVersion
        DocumentSummaryDto firstUpdate = documentService.updateTitle(
                docId,
                userId,
                new UpdateTitleRequest("Title Updated by User A", initialVersion)
        );
        assertEquals("Title Updated by User A", firstUpdate.title());
        assertEquals(initialVersion + 1L, firstUpdate.metadataVersion(), "Version must automatically increment by 1");

        // 4. Second concurrent user attempts to rename using the stale initial version
        assertThrows(OptimisticLockConflictException.class, () -> {
            documentService.updateTitle(
                    docId,
                    userId,
                    new UpdateTitleRequest("Conflicting Title by User B", initialVersion)
            );
        }, "Optimistic locking must reject stale version update to prevent lost updates");
    }
}
