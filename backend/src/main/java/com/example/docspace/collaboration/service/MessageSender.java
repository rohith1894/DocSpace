package com.example.docspace.collaboration.service;

import com.example.docspace.collaboration.model.ServerMessage;

/** Transport-agnostic handle to one connected client. */
public interface MessageSender {

    String id();

    void send(ServerMessage message);
}
