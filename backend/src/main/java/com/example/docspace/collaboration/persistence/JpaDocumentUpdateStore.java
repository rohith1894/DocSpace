package com.example.docspace.collaboration.persistence;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Component
public class JpaDocumentUpdateStore implements DocumentUpdateStore {

    private final DocumentUpdateRepository repository;

    public JpaDocumentUpdateStore(DocumentUpdateRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional(readOnly = true)
    public List<StoredUpdate> load(UUID documentId) {
        return repository.findByDocumentIdOrderBySeqAsc(documentId).stream()
                .map(e -> new StoredUpdate(e.getSeq(), e.getPayload()))
                .toList();
    }

    @Override
    @Transactional
    public void apply(UUID documentId, List<LogOperation> operations) {
        List<DocumentUpdateEntity> inserts = new ArrayList<>();
        for (LogOperation op : operations) {
            switch (op) {
                case LogOperation.Append(StoredUpdate update) ->
                        inserts.add(new DocumentUpdateEntity(documentId, update.seq(), update.payload()));
                case LogOperation.Compact(StoredUpdate snapshot) -> {
                    repository.saveAll(inserts);
                    repository.flush();
                    inserts.clear();
                    repository.deleteUpToSeq(documentId, snapshot.seq());
                    inserts.add(new DocumentUpdateEntity(documentId, snapshot.seq(), snapshot.payload()));
                }
            }
        }
        repository.saveAll(inserts);
    }
}
