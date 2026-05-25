package com.mekongsaltlab.org.config;

import com.mekongsaltlab.org.entity.Role;
import com.mekongsaltlab.org.entity.User;
import com.mekongsaltlab.org.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInit implements CommandLineRunner {
    
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    
    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            // User 1: Regular user
            User user = new User();
            user.setUsername("user");
            user.setEmail("user@mekong.com");
            user.setPassword(passwordEncoder.encode("user123"));
            user.setRole(Role.USER);
            userRepository.save(user);
            log.info("Created default USER: username=user, password=user123");
            
            // User 2: Data manager
            User dataManager = new User();
            dataManager.setUsername("manager");
            dataManager.setEmail("manager@mekong.com");
            dataManager.setPassword(passwordEncoder.encode("manager123"));
            dataManager.setRole(Role.DATA_MANAGER);
            userRepository.save(dataManager);
            log.info("Created default DATA_MANAGER: username=manager, password=manager123");
        }
    }
}
