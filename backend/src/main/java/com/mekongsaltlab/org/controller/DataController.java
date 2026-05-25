package com.mekongsaltlab.org.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/data")
public class DataController {
    
    @GetMapping
    @PreAuthorize("hasAnyRole('DATA_MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, String>> getData() {
        return ResponseEntity.ok(Map.of(
                "message", "This is protected data endpoint",
                "access", "Only DATA_MANAGER role can access this"
        ));
    }
}
