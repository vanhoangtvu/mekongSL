package com.mekongsaltlab.org.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Order(0)
@Slf4j
public class UserRoleMigration implements CommandLineRunner {

    private final JdbcTemplate jdbcTemplate;

    @Override
    public void run(String... args) {
        jdbcTemplate.execute("ALTER TABLE users MODIFY role VARCHAR(32) NOT NULL DEFAULT 'USER'");
        log.info("Ensured users.role column supports USER, DATA_MANAGER, and ADMIN");
    }
}
