package com.mekongsaltlab.org.controller;

import com.mekongsaltlab.org.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/s3")
@RequiredArgsConstructor
@Deprecated(since = "2026-05-26", forRemoval = true)
public class S3Controller {
    
    private final S3Service s3Service;
    
    /**
     * Upload file to S3 (ADMIN + DATA_MANAGER only)
     * @deprecated Use LayerObjectController for GIS layer files instead.
     */
    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, String>> uploadFile(@RequestParam("file") MultipartFile file, @RequestParam(value = "key", required = false) String key) throws Exception {
        String uploadedKey = key != null && !key.isBlank()
                ? s3Service.uploadFile(key.trim(), file)
                : s3Service.uploadFile(file);

        Map<String, String> response = new HashMap<>();
        response.put("key", uploadedKey);
        response.put("url", s3Service.getFileUrl(uploadedKey));
        response.put("message", "File uploaded successfully");

        return ResponseEntity.ok(response);
    }
    
    /**
     * Download file from S3 (All authenticated users)
     */
    @GetMapping("/download/{*key}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<InputStreamResource> downloadFile(@PathVariable String key) {
        InputStream inputStream = s3Service.downloadFile(key);

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + key + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(new InputStreamResource(inputStream));
    }
    
    /**
     * List files in S3 (All authenticated users)
     */
    @GetMapping("/list")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> listFiles(@RequestParam(required = false, defaultValue = "") String prefix) {
        try {
            var files = s3Service.listFiles(prefix);
            
            Map<String, Object> response = new HashMap<>();
            response.put("files", files);
            response.put("count", files.size());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }
    
    /**
     * Delete file from S3 (ADMIN + DATA_MANAGER only)
     */
    @DeleteMapping("/delete/{*key}")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, String>> deleteFile(@PathVariable String key) {
        s3Service.deleteFile(key);

        Map<String, String> response = new HashMap<>();
        response.put("message", "File deleted successfully");

        return ResponseEntity.ok(response);
    }
    
    /**
     * Check if file exists (All authenticated users)
     */
    @GetMapping("/exists/{*key}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Boolean>> fileExists(@PathVariable String key) {
        boolean exists = s3Service.fileExists(key);
        
        Map<String, Boolean> response = new HashMap<>();
        response.put("exists", exists);
        
        return ResponseEntity.ok(response);
    }
}
