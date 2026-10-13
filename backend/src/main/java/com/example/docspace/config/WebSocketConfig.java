package com.example.docspace.config;

import com.example.docspace.collaboration.websocket.CollaborationHandshakeInterceptor;
import com.example.docspace.collaboration.websocket.CollaborationWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final CollaborationWebSocketHandler handler;
    private final CollaborationHandshakeInterceptor handshakeInterceptor;

    public WebSocketConfig(CollaborationWebSocketHandler handler,
                           CollaborationHandshakeInterceptor handshakeInterceptor) {
        this.handler = handler;
        this.handshakeInterceptor = handshakeInterceptor;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Access is enforced by the JWT handshake, so any origin may connect.
        registry.addHandler(handler, "/ws/collaboration")
                .addInterceptors(handshakeInterceptor)
                .setAllowedOriginPatterns("*");
    }
}
