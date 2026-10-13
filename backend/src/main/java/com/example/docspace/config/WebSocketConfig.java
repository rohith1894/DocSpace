package com.example.docspace.config;

import com.example.docspace.collaboration.websocket.CollaborationWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final CollaborationWebSocketHandler collaborationWebSocketHandler;

    public WebSocketConfig(CollaborationWebSocketHandler collaborationWebSocketHandler) {
        this.collaborationWebSocketHandler = collaborationWebSocketHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(collaborationWebSocketHandler, "/ws/collaboration")
                .setAllowedOriginPatterns("*");
    }
}
