package com.example.docspace.collaboration.websocket;

import com.example.docspace.collaboration.model.CollaborationMessage;
import com.example.docspace.collaboration.service.CollaborationRoomManager;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

@Component
public class CollaborationWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(CollaborationWebSocketHandler.class);

    private final CollaborationRoomManager roomManager;
    private final ObjectMapper objectMapper;

    public CollaborationWebSocketHandler(CollaborationRoomManager roomManager, ObjectMapper objectMapper) {
        this.roomManager = roomManager;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        log.debug("WebSocket connection opened: {}", session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        try {
            CollaborationMessage msg = objectMapper.readValue(message.getPayload(), CollaborationMessage.class);

            switch (msg.type()) {
                case JOIN -> {
                    roomManager.joinRoom(msg.documentId(), msg.userId(), msg.userName(), session);
                    // Broadcast user joined event to existing room members
                    roomManager.broadcastToRoom(msg.documentId(), msg, session);
                }
                case UPDATE, PRESENCE -> {
                    // Relay incremental CRDT update or cursor presence to other collaborators in the room
                    roomManager.broadcastToRoom(msg.documentId(), msg, session);
                }
                case LEAVE -> {
                    roomManager.leaveRoom(session);
                    roomManager.broadcastToRoom(msg.documentId(), msg, session);
                }
                case SYNC -> {
                    roomManager.broadcastToRoom(msg.documentId(), msg, session);
                }
            }
        } catch (Exception e) {
            log.error("Error processing WebSocket message from {}: {}", session.getId(), e.getMessage());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        roomManager.leaveRoom(session);
        log.debug("WebSocket connection closed: {}", session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.warn("Transport error on WebSocket {}: {}", session.getId(), exception.getMessage());
        roomManager.leaveRoom(session);
    }
}
