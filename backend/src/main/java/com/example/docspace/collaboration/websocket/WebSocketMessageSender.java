package com.example.docspace.collaboration.websocket;

import com.example.docspace.collaboration.model.ServerMessage;
import com.example.docspace.collaboration.service.MessageSender;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;

import java.io.IOException;

/** Thread-safe {@link MessageSender} that buffers writes so a slow client never blocks the room. */
final class WebSocketMessageSender implements MessageSender {

    private static final Logger log = LoggerFactory.getLogger(WebSocketMessageSender.class);
    private static final int SEND_TIME_LIMIT_MS = 10_000;
    private static final int BUFFER_SIZE_LIMIT = 4 * 1024 * 1024;

    private final WebSocketSession session;
    private final ObjectMapper objectMapper;

    WebSocketMessageSender(WebSocketSession session, ObjectMapper objectMapper) {
        this.session = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, BUFFER_SIZE_LIMIT,
                ConcurrentWebSocketSessionDecorator.OverflowStrategy.TERMINATE);
        this.objectMapper = objectMapper;
    }

    @Override
    public String id() {
        return session.getId();
    }

    @Override
    public void send(ServerMessage message) {
        if (!session.isOpen()) return;
        try {
            session.sendMessage(new TextMessage(objectMapper.writeValueAsString(message)));
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Cannot serialize " + message.type(), e);
        } catch (IOException | RuntimeException e) {
            // A client that cannot keep up is dropped; it resyncs from the log when it reconnects.
            log.debug("Dropping session {}: {}", session.getId(), e.getMessage());
        }
    }
}
