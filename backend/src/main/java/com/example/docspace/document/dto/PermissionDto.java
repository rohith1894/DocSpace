package com.example.docspace.document.dto;

import com.example.docspace.document.entity.DocumentRole;

import java.util.UUID;

public record PermissionDto(
        UUID userId,
        String email,
        String name,
        DocumentRole role
) {}
