package com.example.docspace.collaboration.service;

import com.example.docspace.collaboration.model.CollaborationMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;

import java.io.IOException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArraySet;

/**
 * Thread-safe collaboration room manager.
 * Coordinates multi-user WebSocket rooms using lock-free concurrent collections
 * and atomic session routing.
 */
@Service
public class CollaborationRoomManager {

    private static final Logger log = LoggerFactory.getLogger(CollaborationRoomManager.class);

    // Map: documentId -> Set of active WebSocket sessions
    private final Map<String, Set<WebSocketSession>> documentRooms = new ConcurrentHashMap<>();

    // Map: session.getId() -> SessionMeta (documentId, userId)
    private final Map<String, SessionMeta> sessionRegistry = new ConcurrentHashMap<>();

    private final ObjectMapper objectMapper;

    public CollaborationRoomManager(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public record SessionMeta(String documentId, String userId, String userName) {}

    public void joinRoom(String documentId, String userId, String userName, WebSocketSession session) {
        documentRooms.computeIfAbsent(documentId, k -> new CopyOnWriteArraySet<>()).add(session);
        sessionRegistry.put(session.getId(), new SessionMeta(documentId, userId, userName));

        log.info("User {} joined document room {}. Active members: {}",
                userName, documentId, documentRooms.get(documentId).size());
    }

    public void leaveRoom(WebSocketSession session) {
        SessionMeta meta = sessionRegistry.remove(session.getId());
        if (meta != null) {
            Set<WebSocketSession> sessions = documentRooms.get(meta.documentId());
            if (sessions != null) {
                sessions.remove(session);
                if (sessions.isEmpty()) {
                    documentRooms.remove(meta.documentId());
                }
            }
            log.info("Session {} left room {}", session.getId(), meta.documentId());
        }
    }

    public void broadcastToRoom(String documentId, CollaborationMessage message, WebSocketSession senderSession) {
        Set<WebSocketSession> sessions = documentRooms.get(documentId);
        if (sessions == null || sessions.isEmpty()) return;

        try {
            String jsonPayload = objectMapper.writeValueAsString(message);
            TextMessage textMessage = new TextMessage(jsonPayload);

            for (WebSocketSession s : sessions) {
                // Do not echo back to the sender
                if (s.isOpen() && (senderSession == null || !s.getId().equals(senderSession.getId()))) {
                    // Prevent concurrent write race on the same WebSocket session
                    synchronized (s) {
                        try {
                            s.sendMessage(textMessage);
                        } catch (IOException e) {
                            log.error("Failed to deliver message to session {}: {}", s.getId(), e.getMessage());
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.error("Failed to serialize collaboration message: {}", e.getMessage());
        }
    }

    public int getRoomSubscriberCount(String documentId) {
        Set<WebSocketSession> sessions = documentRooms.get(documentId);
        return sessions != null ? sessions.size() : 0;
    }

    public java.util.List<SessionMeta> getActiveMembers(String documentId, String excludeSessionId) {
        Set<WebSocketSession> sessions = documentRooms.get(documentId);
        if (sessions == null) return java.util.Collections.emptyList();
        java.util.List<SessionMeta> members = new java.util.ArrayList<>();
        for (WebSocketSession s : sessions) {
            if (s.isOpen() && (excludeSessionId == null || !s.getId().equals(excludeSessionId))) {
                SessionMeta meta = sessionRegistry.get(s.getId());
                if (meta != null) {
                    members.add(meta);
                }
            }
        }
        return members;
    }
}
