package com.example.docspace.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class CollaborationConfig {

    /** Single thread keeps database writes in the same order as the in-memory update log. */
    @Bean(name = "collaborationPersistenceExecutor", destroyMethod = "close")
    public ScheduledExecutorService collaborationPersistenceExecutor() {
        return Executors.newSingleThreadScheduledExecutor(Thread.ofPlatform().name("collab-persist").factory());
    }
}
