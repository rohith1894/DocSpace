package com.example.docspace.collaboration.websocket;

import com.example.docspace.auth.repository.UserRepository;
import com.example.docspace.auth.security.JwtTokenProvider;
import com.example.docspace.collaboration.model.CollaboratorIdentity;
import com.example.docspace.document.entity.DocumentRole;
import com.example.docspace.document.service.DocumentService;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.MultiValueMap;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;
import org.springframework.web.util.UriComponentsBuilder;

import java.util.Map;
import java.util.UUID;

/**
 * Authenticates the WebSocket handshake ({@code ?token=<jwt>&documentId=<uuid>}).
 *
 * <p>Browsers cannot read the HTTP status of a rejected handshake, so a failed check still
 * upgrades the connection and records a close status; the handler then closes with an
 * application close code the client can act on (e.g. stop reconnecting).</p>
 */
@Component
public class CollaborationHandshakeInterceptor implements HandshakeInterceptor {

    static final String IDENTITY_ATTR = "collaboration.identity";
    static final String REJECTION_ATTR = "collaboration.rejection";

    public static final CloseStatus UNAUTHORIZED = new CloseStatus(4401, "Authentication required");
    public static final CloseStatus FORBIDDEN = new CloseStatus(4403, "No access to this document");
    public static final CloseStatus NOT_FOUND = new CloseStatus(4404, "Document not found");

    private final JwtTokenProvider tokenProvider;
    private final DocumentService documentService;
    private final UserRepository userRepository;

    public CollaborationHandshakeInterceptor(JwtTokenProvider tokenProvider,
                                             DocumentService documentService,
                                             UserRepository userRepository) {
        this.tokenProvider = tokenProvider;
        this.documentService = documentService;
        this.userRepository = userRepository;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Map<String, Object> attributes) {
        MultiValueMap<String, String> params = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
        String token = params.getFirst("token");
        UUID documentId = parseUuid(params.getFirst("documentId"));

        if (token == null || !tokenProvider.validateToken(token)) {
            attributes.put(REJECTION_ATTR, UNAUTHORIZED);
            return true;
        }
        if (documentId == null) {
            attributes.put(REJECTION_ATTR, NOT_FOUND);
            return true;
        }

        UUID userId = tokenProvider.getUserIdFromToken(token);
        var user = userRepository.findById(userId);
        if (user.isEmpty()) {
            attributes.put(REJECTION_ATTR, UNAUTHORIZED);
            return true;
        }

        var role = documentService.findUserRole(documentId, userId);
        if (role.isEmpty()) {
            attributes.put(REJECTION_ATTR, documentService.exists(documentId) ? FORBIDDEN : NOT_FOUND);
            return true;
        }

        boolean canEdit = role.get() != DocumentRole.VIEWER;
        attributes.put(IDENTITY_ATTR, new CollaboratorIdentity(documentId, userId, user.get().getName(), canEdit));
        return true;
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                               WebSocketHandler wsHandler, Exception exception) {
        // nothing to do
    }

    private static UUID parseUuid(String value) {
        if (value == null) return null;
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
