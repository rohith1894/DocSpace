package com.example.docspace.document.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateTitleRequest(
        @NotBlank(message = "Title cannot be blank")
        String title,

        Long expectedVersion
) {}
