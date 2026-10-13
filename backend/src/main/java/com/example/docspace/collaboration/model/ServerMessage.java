package com.example.docspace.collaboration.model;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.List;

/**
 * Message sent from the collaboration server to a browser.
 * Built through the static factories so every type carries exactly the fields it needs.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public record ServerMessage(
        Type type,
        String update,
        List<String> updates,
        Long seq,
        Integer logSize,
        Boolean needsSeed,
        Boolean canEdit,
        List<Member> members,
        String message
) {

    public enum Type {
        /** Full document log sent once after joining. */
        SYNC,
        /** Incremental update produced by another collaborator. */
        UPDATE,
        /** Confirms the sender's own update was stored at {@code seq}. */
        ACK,
        /** Current list of people in the room. */
        MEMBERS,
        PONG,
        ERROR
    }

    public record Member(String userId, String name, int connections) {}

    public static ServerMessage sync(List<String> updates, long seq, boolean needsSeed, boolean canEdit) {
        return new ServerMessage(Type.SYNC, null, updates, seq, updates.size(), needsSeed, canEdit, null, null);
    }

    public static ServerMessage update(String update, long seq) {
        return new ServerMessage(Type.UPDATE, update, null, seq, null, null, null, null, null);
    }

    public static ServerMessage ack(long seq, int logSize) {
        return new ServerMessage(Type.ACK, null, null, seq, logSize, null, null, null, null);
    }

    public static ServerMessage members(List<Member> members) {
        return new ServerMessage(Type.MEMBERS, null, null, null, null, null, null, members, null);
    }

    public static ServerMessage pong() {
        return new ServerMessage(Type.PONG, null, null, null, null, null, null, null, null);
    }

    public static ServerMessage error(String message) {
        return new ServerMessage(Type.ERROR, null, null, null, null, null, null, null, message);
    }
}
