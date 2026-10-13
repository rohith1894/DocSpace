package com.example.docspace.collaboration.model;

import java.util.UUID;

public record CollaborationMessage(
        MessageType type,
        UUID documentId,
        UUID userId,
        String userName,
        String payload
) {}
