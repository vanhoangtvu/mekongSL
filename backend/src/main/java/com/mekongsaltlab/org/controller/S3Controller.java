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
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import software.amazon.awssdk.services.s3.model.CommonPrefix;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

@RestController
@RequestMapping("/api/s3")
@RequiredArgsConstructor
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

    /**
     * List folders (common prefixes) at given prefix
     */
    @GetMapping("/folders")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> listFolders(@RequestParam(defaultValue = "") String prefix) {
        try {
            ListObjectsV2Response response = s3Service.listFolder(prefix);

            List<String> folders = response.commonPrefixes().stream()
                .map(CommonPrefix::prefix)
                .collect(Collectors.toList());

            List<Map<String, Object>> files = response.contents().stream()
                .filter(obj -> !obj.key().equals(prefix))
                .map(obj -> {
                    Map<String, Object> f = new HashMap<>();
                    f.put("key", obj.key());
                    f.put("size", obj.size());
                    f.put("lastModified", obj.lastModified() != null ? obj.lastModified().toString() : null);
                    return f;
                })
                .collect(Collectors.toList());

            Map<String, Object> result = new HashMap<>();
            result.put("folders", folders);
            result.put("files", files);
            result.put("prefix", prefix);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * Copy file within S3
     */
    @PostMapping("/copy")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, String>> copyFile(@RequestBody Map<String, String> request) {
        String sourceKey = request.get("sourceKey");
        String destinationKey = request.get("destinationKey");

        if (sourceKey == null || destinationKey == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "sourceKey and destinationKey are required"));
        }

        s3Service.copyFile(sourceKey, destinationKey);

        Map<String, String> response = new HashMap<>();
        response.put("message", "File copied successfully");
        response.put("sourceKey", sourceKey);
        response.put("destinationKey", destinationKey);

        return ResponseEntity.ok(response);
    }

    /**
     * Rename file within S3
     */
    @PostMapping("/rename")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, String>> renameFile(@RequestBody Map<String, String> request) {
        String oldKey = request.get("oldKey");
        String newKey = request.get("newKey");

        if (oldKey == null || newKey == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "oldKey and newKey are required"));
        }

        s3Service.renameFile(oldKey, newKey);

        Map<String, String> response = new HashMap<>();
        response.put("message", "File renamed successfully");
        response.put("oldKey", oldKey);
        response.put("newKey", newKey);

        return ResponseEntity.ok(response);
    }

    /**
     * Rename folder (all objects under prefix)
     */
    @PostMapping("/rename-folder")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, String>> renameFolder(@RequestBody Map<String, String> request) {
        String oldPrefix = request.get("oldPrefix");
        String newPrefix = request.get("newPrefix");

        if (oldPrefix == null || newPrefix == null) {
            return ResponseEntity.badRequest().body(Map.of("error", "oldPrefix and newPrefix are required"));
        }

        s3Service.renameFolder(oldPrefix, newPrefix);

        Map<String, String> response = new HashMap<>();
        response.put("message", "Folder renamed successfully");
        response.put("oldPrefix", oldPrefix);
        response.put("newPrefix", newPrefix);

        return ResponseEntity.ok(response);
    }

    /**
     * Create folder (empty placeholder object)
     */
    @PostMapping("/create-folder")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, String>> createFolder(@RequestBody Map<String, String> request) {
        String folderPath = request.get("path");
        if (folderPath == null || folderPath.trim().isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "path is required"));
        }

        String normalizedPath = folderPath.endsWith("/") ? folderPath : folderPath + "/";

        try {
            // Create a zero-byte object to represent the folder
            s3Service.uploadFile(normalizedPath, new java.io.ByteArrayInputStream(new byte[0]), 0);

            Map<String, String> response = new HashMap<>();
            response.put("message", "Folder created successfully");
            response.put("path", normalizedPath);

            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }
}
