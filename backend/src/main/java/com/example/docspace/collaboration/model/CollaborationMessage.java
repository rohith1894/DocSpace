package com.example.docspace.collaboration.model;

public record CollaborationMessage(
        MessageType type,
        String documentId,
        String userId,
        String userName,
        String payload
) {}
