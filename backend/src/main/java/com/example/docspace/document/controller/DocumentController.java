package com.example.docspace.document.controller;

import com.example.docspace.auth.security.UserPrincipal;
import com.example.docspace.common.dto.ApiResponse;
import com.example.docspace.document.dto.*;
import com.example.docspace.document.service.DocumentService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {

    private final DocumentService documentService;

    public DocumentController(DocumentService documentService) {
        this.documentService = documentService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<DocumentSummaryDto>>> listDocuments(
            @AuthenticationPrincipal UserPrincipal principal) {
        List<DocumentSummaryDto> list = documentService.getDocuments(principal.getId());
        return ResponseEntity.ok(ApiResponse.ok(list));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentDetailDto>> getDocument(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        DocumentDetailDto doc = documentService.getDocumentById(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok(doc));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<DocumentSummaryDto>> createDocument(
            @RequestBody(required = false) CreateDocumentRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        DocumentSummaryDto created = documentService.createDocument(principal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Document created successfully", created));
    }

    @PatchMapping("/{id}")
    public ResponseEntity<ApiResponse<DocumentSummaryDto>> updateTitle(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateTitleRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        DocumentSummaryDto updated = documentService.updateTitle(id, principal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Title updated successfully", updated));
    }

    @PutMapping("/{id}/content")
    public ResponseEntity<ApiResponse<Void>> saveContent(
            @PathVariable UUID id,
            @RequestBody SaveContentRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        documentService.saveContent(id, principal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Content saved successfully", null));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteDocument(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserPrincipal principal) {
        documentService.deleteDocument(id, principal.getId());
        return ResponseEntity.ok(ApiResponse.ok("Document deleted successfully", null));
    }

    @PostMapping("/{id}/share")
    public ResponseEntity<ApiResponse<PermissionDto>> shareDocument(
            @PathVariable UUID id,
            @Valid @RequestBody ShareDocumentRequest request,
            @AuthenticationPrincipal UserPrincipal principal) {
        PermissionDto perm = documentService.shareDocument(id, principal.getId(), request);
        return ResponseEntity.ok(ApiResponse.ok("Document shared successfully", perm));
    }

    @DeleteMapping("/{id}/share/{targetUserId}")
    public ResponseEntity<ApiResponse<Void>> removePermission(
            @PathVariable UUID id,
            @PathVariable UUID targetUserId,
            @AuthenticationPrincipal UserPrincipal principal) {
        documentService.removePermission(id, principal.getId(), targetUserId);
        return ResponseEntity.ok(ApiResponse.ok("Permission removed successfully", null));
    }
}
