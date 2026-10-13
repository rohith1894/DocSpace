package com.example.docspace.document.dto;

import com.example.docspace.document.entity.DocumentRole;

import java.time.Instant;
import java.util.UUID;

public record DocumentSummaryDto(
        UUID id,
        String title,
        UUID ownerId,
        String ownerEmail,
        Instant createdAt,
        Instant updatedAt,
        Long metadataVersion,
        DocumentRole currentUserRole
) {}
