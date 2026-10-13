package com.example.docspace.collaboration.model;

import java.util.UUID;

/** Authenticated user bound to a WebSocket session during the handshake. */
public record CollaboratorIdentity(UUID documentId, UUID userId, String name, boolean canEdit) {}
