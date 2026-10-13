package com.example.docspace.document.dto;

import com.example.docspace.document.entity.DocumentRole;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record DocumentDetailDto(
        UUID id,
        String title,
        String content,
        UUID ownerId,
        String ownerEmail,
        Instant createdAt,
        Instant updatedAt,
        Long metadataVersion,
        DocumentRole currentUserRole,
        List<PermissionDto> permissions
) {}
