package com.example.docspace.collaboration.websocket;

import com.example.docspace.collaboration.model.ClientMessage;
import com.example.docspace.collaboration.model.CollaboratorIdentity;
import com.example.docspace.collaboration.model.ServerMessage;
import com.example.docspace.collaboration.service.CollaborationRoomManager;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.websocket.Session;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.adapter.NativeWebSocketSession;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;

@Component
public class CollaborationWebSocketHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(CollaborationWebSocketHandler.class);
    /** Snapshots of large documents exceed Tomcat's 8 KB default, which would close the socket. */
    private static final int MAX_MESSAGE_BYTES = 2 * 1024 * 1024;
    /** Clients ping every 20 s; a socket silent for longer is dead (e.g. a suspended phone). */
    private static final long IDLE_TIMEOUT_MS = 60_000;

    private final CollaborationRoomManager roomManager;
    private final ObjectMapper objectMapper;

    public CollaborationWebSocketHandler(CollaborationRoomManager roomManager, ObjectMapper objectMapper) {
        this.roomManager = roomManager;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws IOException {
        Object rejection = session.getAttributes().get(CollaborationHandshakeInterceptor.REJECTION_ATTR);
        if (rejection instanceof CloseStatus status) {
            session.close(status);
            return;
        }
        session.setTextMessageSizeLimit(MAX_MESSAGE_BYTES);
        if (session instanceof NativeWebSocketSession nativeSession) {
            Session wsSession = nativeSession.getNativeSession(Session.class);
            if (wsSession != null) wsSession.setMaxIdleTimeout(IDLE_TIMEOUT_MS);
        }
        CollaboratorIdentity identity =
                (CollaboratorIdentity) session.getAttributes().get(CollaborationHandshakeInterceptor.IDENTITY_ATTR);
        roomManager.join(new WebSocketMessageSender(session, objectMapper), identity);
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        ClientMessage msg;
        try {
            msg = objectMapper.readValue(message.getPayload(), ClientMessage.class);
        } catch (IOException e) {
            log.debug("Ignoring malformed message from {}", session.getId());
            return;
        }
        if (msg.type() == null) return;

        switch (msg.type()) {
            case UPDATE -> roomManager.applyUpdate(session.getId(), msg.update());
            case SNAPSHOT -> {
                if (msg.upToSeq() != null) {
                    roomManager.applySnapshot(session.getId(), msg.update(), msg.upToSeq());
                }
            }
            case PING -> roomManager.pong(session.getId());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        roomManager.leave(session.getId());
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("Transport error on {}: {}", session.getId(), exception.getMessage());
        roomManager.leave(session.getId());
    }
}
