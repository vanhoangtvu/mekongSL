package com.mekongsaltlab.org.service;

import com.mekongsaltlab.org.dto.UserResponse;
import com.mekongsaltlab.org.dto.UserUpsertRequest;
import com.mekongsaltlab.org.entity.Role;
import com.mekongsaltlab.org.entity.User;
import com.mekongsaltlab.org.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<UserResponse> listUsers() {
        return userRepository.findAll().stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public UserResponse getCurrentUser() {
        return toResponse(resolveAuthenticatedUser());
    }

    @Transactional
    public UserResponse createUser(UserUpsertRequest request) {
        String username = request.getUsername().trim();
        String email = request.getEmail().trim();

        if (userRepository.existsByUsername(username)) {
            throw new RuntimeException("Username already exists");
        }
        if (userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already exists");
        }
        if (request.getPassword() == null || request.getPassword().isBlank()) {
            throw new RuntimeException("Password is required");
        }

        User user = new User();
        applyUpsert(user, request, true);
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(request.getPassword()));
        userRepository.save(user);

        return toResponse(user);
    }

    @Transactional
    public UserResponse updateUser(Long id, UserUpsertRequest request) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        String username = request.getUsername().trim();
        String email = request.getEmail().trim();

        User currentUser = resolveAuthenticatedUser();
        boolean isSelf = currentUser.getUsername().equals(user.getUsername());
        boolean roleChanged = request.getRole() != null && request.getRole() != user.getRole();

        if (isSelf && roleChanged) {
            throw new AccessDeniedException("You cannot change your own role");
        }

        if (isSelf && request.getEnabled() != null && !request.getEnabled()) {
            throw new AccessDeniedException("You cannot disable your own account");
        }

        if (!username.equals(user.getUsername()) && userRepository.existsByUsername(username)) {
            throw new RuntimeException("Username already exists");
        }

        if (!email.equals(user.getEmail()) && userRepository.existsByEmail(email)) {
            throw new RuntimeException("Email already exists");
        }

        applyUpsert(user, request, false);
        user.setUsername(username);
        user.setEmail(email);

        if (request.getPassword() != null && !request.getPassword().isBlank()) {
            user.setPassword(passwordEncoder.encode(request.getPassword()));
        }

        if (Boolean.TRUE.equals(request.getEnabled())) {
            user.setEnabled(true);
        } else if (Boolean.FALSE.equals(request.getEnabled())) {
            user.setEnabled(false);
        }

        userRepository.save(user);
        return toResponse(user);
    }

    @Transactional
    public void deleteUser(Long id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("User not found"));

        User currentUser = resolveAuthenticatedUser();
        if (currentUser.getId().equals(user.getId())) {
            throw new AccessDeniedException("You cannot delete your own account");
        }

        if (user.getRole() == Role.ADMIN && userRepository.countByRole(Role.ADMIN) <= 1) {
            throw new RuntimeException("At least one ADMIN account must remain");
        }

        userRepository.delete(user);
    }

    private void applyUpsert(User user, UserUpsertRequest request, boolean createMode) {
        user.setUsername(request.getUsername().trim());
        user.setEmail(request.getEmail().trim());
        user.setRole(request.getRole());

        if (createMode) {
            user.setEnabled(request.getEnabled() == null || request.getEnabled());
        } else if (request.getEnabled() != null) {
            user.setEnabled(request.getEnabled());
        }
    }

    private User resolveAuthenticatedUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getName() == null) {
            throw new AccessDeniedException("Unauthorized");
        }

        return userRepository.findByUsername(authentication.getName())
                .orElseThrow(() -> new AccessDeniedException("User not found"));
    }

    private UserResponse toResponse(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.getRole().name(),
                Boolean.TRUE.equals(user.getEnabled()),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
