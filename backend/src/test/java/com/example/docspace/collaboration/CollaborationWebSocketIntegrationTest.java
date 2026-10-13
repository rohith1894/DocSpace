package com.example.docspace.collaboration;

import com.example.docspace.auth.dto.RegisterRequest;
import com.example.docspace.auth.service.AuthService;
import com.example.docspace.document.dto.CreateDocumentRequest;
import com.example.docspace.document.dto.ShareDocumentRequest;
import com.example.docspace.document.entity.DocumentRole;
import com.example.docspace.document.service.DocumentService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.util.Base64;
import java.util.UUID;
import java.util.concurrent.*;

import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CollaborationWebSocketIntegrationTest {

    @LocalServerPort
    private int port;

    @Autowired
    private AuthService authService;

    @Autowired
    private DocumentService documentService;

    private final ObjectMapper mapper = new ObjectMapper();

    private String ownerToken;
    private String viewerToken;
    private String strangerToken;
    private UUID documentId;

    @BeforeEach
    void setUp() {
        String suffix = UUID.randomUUID().toString();
        var owner = authService.register(new RegisterRequest("owner-" + suffix + "@test.io", "Owner", "password123"));
        var viewer = authService.register(new RegisterRequest("viewer-" + suffix + "@test.io", "Viewer", "password123"));
        var stranger = authService.register(new RegisterRequest("stranger-" + suffix + "@test.io", "Stranger", "password123"));
        ownerToken = owner.token();
        viewerToken = viewer.token();
        strangerToken = stranger.token();

        documentId = documentService.createDocument(owner.user().id(), new CreateDocumentRequest("WS test")).id();
        documentService.shareDocument(documentId, owner.user().id(),
                new ShareDocumentRequest(viewer.user().email(), DocumentRole.VIEWER));
    }

    @Test
    void editorUpdatesReachOtherConnectionsAndLateJoiners() throws Exception {
        Client laptop = connect(ownerToken, documentId.toString());
        Client phone = connect(ownerToken, documentId.toString());
        assertEquals("SYNC", laptop.next("SYNC").get("type").asText());
        phone.next("SYNC");

        String update = Base64.getEncoder().encodeToString(new byte[]{1, 2, 3});
        laptop.send("{\"type\":\"UPDATE\",\"update\":\"" + update + "\"}");

        JsonNode relayed = phone.next("UPDATE");
        assertEquals(update, relayed.get("update").asText());
        assertEquals(1, laptop.next("ACK").get("seq").asLong());

        Client tablet = connect(ownerToken, documentId.toString());
        JsonNode sync = tablet.next("SYNC");
        assertEquals(update, sync.get("updates").get(0).asText());
    }

    @Test
    void viewerCanReadButNotWrite() throws Exception {
        Client viewer = connect(viewerToken, documentId.toString());
        JsonNode sync = viewer.next("SYNC");
        assertFalse(sync.get("canEdit").asBoolean());

        viewer.send("{\"type\":\"UPDATE\",\"update\":\"AQID\"}");
        assertEquals("ERROR", viewer.next("ERROR").get("type").asText());
    }

    @Test
    void rejectsMissingTokenAndForeignDocuments() throws Exception {
        assertEquals(4401, connect("bad-token", documentId.toString()).closeStatus().getCode());
        assertEquals(4403, connect(strangerToken, documentId.toString()).closeStatus().getCode());
        assertEquals(4404, connect(ownerToken, UUID.randomUUID().toString()).closeStatus().getCode());
    }

    @Test
    void pingIsAnswered() throws Exception {
        Client client = connect(ownerToken, documentId.toString());
        client.send("{\"type\":\"PING\"}");
        assertNotNull(client.next("PONG"));
    }

    private Client connect(String token, String docId) throws Exception {
        Client client = new Client();
        String url = "ws://localhost:" + port + "/ws/collaboration?token=" + token + "&documentId=" + docId;
        client.session = new StandardWebSocketClient().execute(client, url).get(5, TimeUnit.SECONDS);
        return client;
    }

    private final class Client extends TextWebSocketHandler {
        private final BlockingQueue<JsonNode> inbox = new LinkedBlockingQueue<>();
        private final CompletableFuture<CloseStatus> closed = new CompletableFuture<>();
        WebSocketSession session;

        @Override
        protected void handleTextMessage(WebSocketSession s, TextMessage message) throws Exception {
            inbox.add(mapper.readTree(message.getPayload()));
        }

        @Override
        public void afterConnectionClosed(WebSocketSession s, CloseStatus status) {
            closed.complete(status);
        }

        void send(String json) throws Exception {
            session.sendMessage(new TextMessage(json));
        }

        JsonNode next(String type) throws InterruptedException {
            while (true) {
                JsonNode msg = inbox.poll(5, TimeUnit.SECONDS);
                assertNotNull(msg, "timed out waiting for " + type);
                if (type.equals(msg.get("type").asText())) return msg;
            }
        }

        CloseStatus closeStatus() throws Exception {
            return closed.get(5, TimeUnit.SECONDS);
        }
    }
}
