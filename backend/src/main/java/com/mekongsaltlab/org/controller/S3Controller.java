package com.mekongsaltlab.org.controller;

import com.mekongsaltlab.org.service.DownloadTokenService;
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
import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.model.CommonPrefix;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.ListObjectsV2Response;
import software.amazon.awssdk.services.s3.model.S3Object;

@RestController
@RequestMapping("/api/s3")
@RequiredArgsConstructor
public class S3Controller {

    private static final List<String> ALLOWED_S3_PREFIXES = List.of(
        "gis-data/", "station-data/", "monitoring-data/", "news-images/"
    );
    
    private final S3Service s3Service;
    private final DownloadTokenService downloadTokenService;
    
    /**
     * Upload file to S3 (ADMIN + DATA_MANAGER only)
     * Validates key prefix (must be gis-data/, station-data/, or monitoring-data/) and file size.
     */
    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, Object>> uploadFile(
        @RequestParam("file") MultipartFile file,
        @RequestParam(value = "key", required = false) String key,
        @RequestParam(value = "overwrite", required = false, defaultValue = "false") boolean overwrite
    ) throws Exception {
        // Validate key prefix when custom key is provided
        if (key != null && !key.isBlank()) {
            String trimmedKey = key.trim();
            boolean validPrefix = ALLOWED_S3_PREFIXES.stream().anyMatch(trimmedKey::startsWith);
            if (!validPrefix) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid S3 key prefix. Key must start with one of: " + ALLOWED_S3_PREFIXES);
                return ResponseEntity.badRequest().body(error);
            }
        }

        String uploadedKey = key != null && !key.isBlank()
                ? s3Service.uploadFile(key.trim(), file, overwrite)
                : s3Service.uploadFile(file);

        Map<String, Object> response = new HashMap<>();
        response.put("key", uploadedKey);
        response.put("url", s3Service.getFileUrl(uploadedKey));
        response.put("message", "File uploaded successfully");

        return ResponseEntity.ok(response);
    }
    
    /**
     * Download file from S3 (All authenticated users)
     */
    @GetMapping(value = {"/download", "/download/{*key}"})
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<InputStreamResource> downloadFile(
        @PathVariable(required = false) String key,
        @RequestParam(value = "key", required = false) String queryKey
    ) {
        String keyToDownload = queryKey != null && !queryKey.isBlank() ? queryKey : key;
        if (keyToDownload == null || keyToDownload.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        String cleanKey = keyToDownload.startsWith("/") ? keyToDownload.substring(1) : keyToDownload;
        InputStream inputStream = s3Service.downloadFile(cleanKey);
        String filename = cleanKey.contains("/") ? cleanKey.substring(cleanKey.lastIndexOf("/") + 1) : cleanKey;

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(new InputStreamResource(inputStream));
    }

    @PostMapping("/download-token")
    public ResponseEntity<Map<String, Object>> createDownloadToken(@RequestBody Map<String, String> body) {
        String key = body.get("key");
        if (key == null || key.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "key is required"));
        }
        String cleanKey = key.startsWith("/") ? key.substring(1) : key;
        if (!cleanKey.startsWith("gis-data/")) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid key prefix"));
        }
        String token = downloadTokenService.createToken(cleanKey);
        return ResponseEntity.ok(Map.of("token", token, "expiresIn", 300));
    }

    @GetMapping("/download-by-token")
    public ResponseEntity<?> downloadByToken(@RequestParam String token) {
        if (token == null || token.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "token is required"));
        }
        String key = downloadTokenService.resolveToken(token);
        if (key == null) {
            return ResponseEntity.status(410).body(Map.of("error", "Token expired or invalid"));
        }
        downloadTokenService.removeToken(token);
        try {
            InputStream inputStream = s3Service.downloadFile(key);
            String filename = key.contains("/") ? key.substring(key.lastIndexOf("/") + 1) : key;
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(new InputStreamResource(inputStream));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", e.getMessage()));
        }
    }

    /**
     * List files in S3
     * Public access allowed for gis-data/ prefix (used by map viewer).
     * Authentication required for other prefixes.
     */
    @GetMapping("/list")
    public ResponseEntity<Map<String, Object>> listFiles(@RequestParam(required = false, defaultValue = "") String prefix) {
        try {
            // Public access only for gis-data/ prefix
            if (!prefix.startsWith("gis-data/")) {
                // For non-gis-data prefixes, require authentication
                org.springframework.security.core.Authentication auth = 
                    org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
                if (auth == null || !auth.isAuthenticated() || 
                    auth instanceof org.springframework.security.authentication.AnonymousAuthenticationToken) {
                    return ResponseEntity.status(403).body(Map.of("error", "Authentication required for this prefix"));
                }
            }
            
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
    @DeleteMapping(value = {"/delete", "/delete/{*key}"})
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, String>> deleteFile(
        @PathVariable(required = false) String key,
        @RequestParam(value = "key", required = false) String queryKey
    ) {
        String keyToDelete = queryKey != null && !queryKey.isBlank() ? queryKey : key;
        if (keyToDelete == null || keyToDelete.isBlank()) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Key is required");
            return ResponseEntity.badRequest().body(error);
        }
        String cleanKey = keyToDelete.startsWith("/") ? keyToDelete.substring(1) : keyToDelete;
        if (ALLOWED_S3_PREFIXES.stream().noneMatch(cleanKey::startsWith)) {
            Map<String, String> error = new HashMap<>();
            error.put("error", "Invalid S3 key prefix. Key must start with one of: " + ALLOWED_S3_PREFIXES);
            return ResponseEntity.badRequest().body(error);
        }
        s3Service.deleteFile(cleanKey);

        Map<String, String> response = new HashMap<>();
        response.put("message", "File deleted successfully");

        return ResponseEntity.ok(response);
    }
    
    /**
     * Check if file exists (All authenticated users)
     */
    @GetMapping(value = {"/exists", "/exists/{*key}"})
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Boolean>> fileExists(
        @PathVariable(required = false) String key,
        @RequestParam(value = "key", required = false) String queryKey
    ) {
        String keyToCheck = queryKey != null && !queryKey.isBlank() ? queryKey : key;
        if (keyToCheck == null || keyToCheck.isBlank()) {
            Map<String, Boolean> response = new HashMap<>();
            response.put("exists", false);
            return ResponseEntity.badRequest().body(response);
        }
        String cleanKey = keyToCheck.startsWith("/") ? keyToCheck.substring(1) : keyToCheck;
        boolean exists = s3Service.fileExists(cleanKey);
        
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
     * Generate a signed GET URL for an S3 key.
     * Unlike /objects/{id}/signed-url, this works with any S3 key without requiring a DB entity.
     */
    @GetMapping("/signed-url")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<Map<String, Object>> getSignedUrl(
        @RequestParam String key,
        @RequestParam(defaultValue = "3600") long expires
    ) {
        try {
            String cleanKey = key.startsWith("/") ? key.substring(1) : key;
            if (ALLOWED_S3_PREFIXES.stream().noneMatch(cleanKey::startsWith)) {
                Map<String, Object> error = new HashMap<>();
                error.put("error", "Invalid S3 key prefix");
                return ResponseEntity.badRequest().body(error);
            }
            String url = s3Service.createSignedGetUrl(cleanKey, Duration.ofSeconds(expires));
            Map<String, Object> response = new HashMap<>();
            response.put("url", url);
            response.put("expiresAt", Instant.now().plus(Duration.ofSeconds(expires)).toString());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> error = new HashMap<>();
            error.put("error", "Failed to generate signed URL");
            return ResponseEntity.badRequest().body(error);
        }
    }

    /**
     * Serve GeoTIFF file inline (no auth required, restricted to gis-data/ prefix).
     * Supports HTTP Range requests for partial content (required by geotiff.js).
     * Forwards S3's native range support including Content-Range and 206 status.
     */
    @GetMapping("/render")
    public ResponseEntity<?> renderFile(
        @RequestParam String key,
        @RequestHeader(value = "Range", required = false) String range
    ) {
        try {
            String cleanKey = key.startsWith("/") ? key.substring(1) : key;
            if (!cleanKey.startsWith("gis-data/")) {
                return ResponseEntity.badRequest().body(Map.of("error", "Only gis-data/ prefix allowed"));
            }

            String contentType = cleanKey.endsWith(".tif") || cleanKey.endsWith(".tiff")
                ? "image/tiff" : "application/octet-stream";

            ResponseInputStream<GetObjectResponse> s3Stream = s3Service.downloadFileRange(cleanKey, range);
            GetObjectResponse s3Meta = s3Stream.response();

            // Forward the exact HTTP status from S3 (206 for range, 200 for full)
            int httpStatus = s3Meta.sdkHttpResponse().statusCode();

            // Forward Content-Range header from S3 if present
            String contentRange = s3Meta.sdkHttpResponse()
                .firstMatchingHeader(HttpHeaders.CONTENT_RANGE)
                .orElse(null);

            ResponseEntity.BodyBuilder builder = ResponseEntity.status(httpStatus)
                .contentType(MediaType.valueOf(contentType))
                .contentLength(s3Meta.contentLength())
                .header(HttpHeaders.ACCEPT_RANGES, "bytes");

            if (contentRange != null) {
                builder.header(HttpHeaders.CONTENT_RANGE, contentRange);
            }

            final long totalLength = s3Meta.contentLength();
            return builder.body(new InputStreamResource(s3Stream) {
                @Override
                public long contentLength() {
                    return totalLength;
                }
            });
        } catch (software.amazon.awssdk.services.s3.model.NoSuchKeyException e) {
            return ResponseEntity.status(404).body(Map.of("error", "File not found"));
        } catch (software.amazon.awssdk.services.s3.model.S3Exception e) {
            int status = e.statusCode() >= 400 ? e.statusCode() : 502;
            return ResponseEntity.status(status).body(Map.of("error", "S3 error"));
        } catch (Exception e) {
            return ResponseEntity.status(500).body(Map.of("error", "Internal server error"));
        }
    }

    /**
     * Get real storage statistics (Total size, file count, category breakdown)
     */
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, Object>> getStorageStats() {
        return ResponseEntity.ok(s3Service.getStorageStats());
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
