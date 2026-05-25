package com.mekongsaltlab.org.config;

import com.mekongsaltlab.org.entity.Role;
import com.mekongsaltlab.org.entity.User;
import com.mekongsaltlab.org.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Order(1)
@Slf4j
public class DataInit implements CommandLineRunner {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    
    @Override
    public void run(String... args) {
        ensureDefaultUser("user", "user@mekong.com", "user123", Role.USER);
        ensureDefaultUser("manager", "manager@mekong.com", "manager123", Role.DATA_MANAGER);
        ensureDefaultUser("admin", "admin@mekong.com", "admin123", Role.ADMIN);
    }

    private void ensureDefaultUser(String username, String email, String password, Role role) {
        User user = userRepository.findByUsername(username).orElseGet(User::new);
        user.setUsername(username);
        user.setEmail(email);
        user.setPassword(passwordEncoder.encode(password));
        user.setRole(role);
        user.setEnabled(true);

        userRepository.save(user);
        log.info("Ensured default {}: username={}, password={}", role.name(), username, password);
    }
}
