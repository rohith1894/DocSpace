package com.example.docspace.auth.dto;

public record AuthResponse(
        String token,
        UserDto user
) {}
