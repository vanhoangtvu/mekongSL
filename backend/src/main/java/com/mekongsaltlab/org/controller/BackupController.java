package com.mekongsaltlab.org.controller;

import com.mekongsaltlab.org.service.BackupService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/backup")
@RequiredArgsConstructor
public class BackupController {
    
    private final BackupService backupService;
    
    /**
     * Trigger manual backup
     */
    @PostMapping("/trigger")
    @PreAuthorize("hasAnyRole('DATA_MANAGER', 'ADMIN')")
    public ResponseEntity<Map<String, String>> triggerBackup() {
        try {
            String s3Key = backupService.triggerManualBackup();
            
            Map<String, String> response = new HashMap<>();
            response.put("message", "Backup completed successfully");
            response.put("s3_key", s3Key);
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, String> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
}
