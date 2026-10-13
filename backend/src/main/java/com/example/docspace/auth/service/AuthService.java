package com.example.docspace.auth.service;

import com.example.docspace.auth.dto.AuthRequest;
import com.example.docspace.auth.dto.AuthResponse;
import com.example.docspace.auth.dto.RegisterRequest;
import com.example.docspace.auth.dto.UserDto;
import com.example.docspace.auth.entity.UserEntity;
import com.example.docspace.auth.repository.UserRepository;
import com.example.docspace.auth.security.JwtTokenProvider;
import com.example.docspace.common.exception.UnauthorizedAccessException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;

    public AuthService(UserRepository userRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider tokenProvider) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.email().toLowerCase().trim())) {
            throw new IllegalArgumentException("Email is already registered");
        }

        UUID userId = UUID.randomUUID();
        UserEntity user = new UserEntity(
                userId,
                request.email().toLowerCase().trim(),
                request.name().trim(),
                passwordEncoder.encode(request.password()),
                Instant.now()
        );

        userRepository.save(user);

        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        UserDto userDto = new UserDto(user.getId(), user.getEmail(), user.getName());
        return new AuthResponse(token, userDto);
    }

    @Transactional(readOnly = true)
    public AuthResponse login(AuthRequest request) {
        UserEntity user = userRepository.findByEmail(request.email().toLowerCase().trim())
                .orElseThrow(() -> new UnauthorizedAccessException("Invalid email or password"));

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new UnauthorizedAccessException("Invalid email or password");
        }

        String token = tokenProvider.generateToken(user.getId(), user.getEmail());
        UserDto userDto = new UserDto(user.getId(), user.getEmail(), user.getName());
        return new AuthResponse(token, userDto);
    }

    @Transactional(readOnly = true)
    public UserDto getCurrentUser(UUID userId) {
        UserEntity user = userRepository.findById(userId)
                .orElseThrow(() -> new UnauthorizedAccessException("User not found"));
        return new UserDto(user.getId(), user.getEmail(), user.getName());
    }
}
