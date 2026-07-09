package com.mekongsaltlab.org.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import com.mekongsaltlab.org.dto.S3FileResponse;
import com.mekongsaltlab.org.entity.gis.S3Object;
import com.mekongsaltlab.org.repository.gis.S3ObjectRepository;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class S3Service {
    
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final S3ObjectRepository s3ObjectRepository;
    
    @Value("${s3.bucket}")
    private String bucketName;
    
    @Value("${s3.max-file-size:104857600}")
    private long maxFileSize;
    
    /**
     * Upload file to S3 with validation and DB tracking
     */
    @Transactional
    public String uploadFile(String key, MultipartFile file) throws IOException {
        return uploadFile(key, file, false);
    }

    /**
     * Upload file to S3 with validation and optional overwrite
     */
    @Transactional
    public String uploadFile(String key, MultipartFile file, boolean overwrite) throws IOException {
        if (file.getSize() > maxFileSize) {
            throw new RuntimeException("File size exceeds maximum allowed: " + maxFileSize + " bytes");
        }

        if (!overwrite && fileExists(key)) {
            throw new RuntimeException("File already exists at S3 key: " + key + ". Delete the existing file first or use a different key.");
        }

        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(file.getContentType())
                    .build();
            
            PutObjectResponse putResponse = s3Client.putObject(
                putObjectRequest,
                RequestBody.fromInputStream(file.getInputStream(), file.getSize())
            );

            // Upsert S3Object record in DB
            upsertS3Object(key, file, putResponse);

            log.info("Uploaded file to S3: {} (overwrite={})", key, overwrite);
            return key;
        } catch (S3Exception e) {
            var err = e.awsErrorDetails();
            log.error("Failed to upload file to S3: status={}, code={}, message={}", e.statusCode(), err != null ? err.errorCode() : "null", err != null ? err.errorMessage() : e.getMessage());
            throw new RuntimeException("Failed to upload file: " + (err != null ? err.errorMessage() : e.getMessage()));
        }
    }

    private void upsertS3Object(String key, MultipartFile file, PutObjectResponse putResponse) {
        try {
            Optional<S3Object> existing = s3ObjectRepository.findByBucketAndS3Key(bucketName, key);
            S3Object s3Object = existing.orElse(new S3Object());

            s3Object.setBucket(bucketName);
            s3Object.setS3Key(key);
            s3Object.setSizeBytes(file.getSize());
            s3Object.setContentType(file.getContentType());
            s3Object.setEtag(putResponse.eTag());
            s3Object.setIsDeleted(false);
            s3Object.setDeletedAt(null);
            if (existing.isEmpty()) {
                s3Object.setCreatedAt(Instant.now());
            }
            s3Object.setUploadedAt(Instant.now());

            s3ObjectRepository.save(s3Object);
            log.debug("Upserted S3Object record for key: {}", key);
        } catch (Exception e) {
            log.error("Failed to upsert S3Object record for key: {}, error: {}", key, e.getMessage());
        }
    }
    
    /**
     * Upload file with auto-generated key (timestamp-based)
     */
    public String uploadFile(MultipartFile file) throws IOException {
        if (file.getSize() > maxFileSize) {
            throw new RuntimeException("File size exceeds maximum allowed: " + maxFileSize + " bytes");
        }

        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String originalFilename = file.getOriginalFilename() != null
            ? file.getOriginalFilename().replaceAll("[^a-zA-Z0-9_\\-\\.]", "_")
            : "unknown";
        String key = String.format("uploads/%s_%s", timestamp, originalFilename);
        return uploadFile(key, file);
    }
    
    /**
     * Upload file from InputStream (for backup service)
     */
    public String uploadFile(String key, InputStream inputStream, long contentLength) {
        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();
            
            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(inputStream, contentLength));
            
            log.info("Uploaded file to S3: {}", key);
            return key;
        } catch (S3Exception e) {
            var err = e.awsErrorDetails();
            log.error("Failed to upload file to S3: status={}, code={}, message={}", e.statusCode(), err != null ? err.errorCode() : "null", err != null ? err.errorMessage() : e.getMessage());
            throw new RuntimeException("Failed to upload file: " + (err != null ? err.errorMessage() : e.getMessage()));
        }
    }
    
    /**
     * Download file from S3
     */
    public InputStream downloadFile(String key) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();
        return s3Client.getObject(getObjectRequest);
    }

    /**
     * Download file with HTTP Range support (for partial content / 206 responses).
     * Returns the S3 response stream which includes metadata like content length.
     */
    public ResponseInputStream<GetObjectResponse> downloadFileRange(String key, String range) {
        GetObjectRequest.Builder builder = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key);
        if (range != null && !range.isEmpty()) {
            builder.range(range);
        }
        return s3Client.getObject(builder.build());
    }
    
    /**
     * Delete file or folder from S3 and soft-delete in DB
     */
    @Transactional
    public void deleteFile(String key) {
        try {
            if (key.endsWith("/")) {
                // It's a folder: list all objects with this prefix and delete them recursively
                ListObjectsV2Request listRequest = ListObjectsV2Request.builder()
                        .bucket(bucketName)
                        .prefix(key)
                        .build();
                ListObjectsV2Response listResponse;
                do {
                    listResponse = s3Client.listObjectsV2(listRequest);
                    List<ObjectIdentifier> toDelete = listResponse.contents().stream()
                            .map(obj -> ObjectIdentifier.builder().key(obj.key()).build())
                            .collect(Collectors.toList());

                    if (!toDelete.isEmpty()) {
                        DeleteObjectsRequest deleteObjectsRequest = DeleteObjectsRequest.builder()
                                .bucket(bucketName)
                                .delete(Delete.builder().objects(toDelete).build())
                                .build();
                        s3Client.deleteObjects(deleteObjectsRequest);

                        // Soft-delete corresponding records in DB
                        for (ObjectIdentifier objId : toDelete) {
                            s3ObjectRepository.findByBucketAndS3Key(bucketName, objId.key()).ifPresent(s3Object -> {
                                s3Object.setIsDeleted(true);
                                s3Object.setDeletedAt(Instant.now());
                                s3ObjectRepository.save(s3Object);
                            });
                        }
                    }
                    listRequest = listRequest.toBuilder()
                            .continuationToken(listResponse.nextContinuationToken())
                            .build();
                } while (listResponse.isTruncated());
                log.info("Deleted S3 folder and contents recursively: {}", key);
            } else {
                // It's a single file
                DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                        .bucket(bucketName)
                        .key(key)
                        .build();

                s3Client.deleteObject(deleteObjectRequest);
                log.info("Deleted file from S3: {}", key);

                // Soft-delete corresponding record in DB
                s3ObjectRepository.findByBucketAndS3Key(bucketName, key).ifPresent(s3Object -> {
                    s3Object.setIsDeleted(true);
                    s3Object.setDeletedAt(Instant.now());
                    s3ObjectRepository.save(s3Object);
                    log.info("Soft-deleted DB record for S3 key: {}", key);
                });
            }
        } catch (S3Exception e) {
            log.error("Failed to delete file from S3: {}", e.getMessage());
            throw new RuntimeException("Failed to delete file: " + e.getMessage());
        }
    }
    
    /**
     * List files in S3 bucket
     */
    public List<S3FileResponse> listFiles(String prefix) {
        try {
            ListObjectsV2Request listRequest = ListObjectsV2Request.builder()
                    .bucket(bucketName)
                    .prefix(prefix)
                    .build();
            
            ListObjectsV2Response listResponse = s3Client.listObjectsV2(listRequest);
            
            return listResponse.contents().stream()
                    .map(object -> new S3FileResponse(
                            object.key(),
                            object.size(),
                            object.lastModified() == null ? null : object.lastModified().toString()
                    ))
                    .collect(Collectors.toList());
        } catch (S3Exception e) {
            log.error("Failed to list files from S3: {}", e.getMessage());
            throw new RuntimeException("Failed to list files: " + e.getMessage());
        }
    }
    
    /**
     * List files with delimiter support (folder-like view)
     */
    public ListObjectsV2Response listFolder(String prefix) {
        try {
            ListObjectsV2Request listRequest = ListObjectsV2Request.builder()
                    .bucket(bucketName)
                    .prefix(prefix)
                    .delimiter("/")
                    .build();

            return s3Client.listObjectsV2(listRequest);
        } catch (S3Exception e) {
            log.error("Failed to list folder from S3: {}", e.getMessage());
            throw new RuntimeException("Failed to list folder: " + e.getMessage());
        }
    }

    /**
     * Copy file within S3 bucket
     */
    public void copyFile(String sourceKey, String destinationKey) {
        try {
            CopyObjectRequest copyRequest = CopyObjectRequest.builder()
                    .sourceBucket(bucketName)
                    .sourceKey(sourceKey)
                    .destinationBucket(bucketName)
                    .destinationKey(destinationKey)
                    .build();

            s3Client.copyObject(copyRequest);
            log.info("Copied S3 object from {} to {}", sourceKey, destinationKey);
        } catch (S3Exception e) {
            log.error("Failed to copy file in S3: {}", e.getMessage());
            throw new RuntimeException("Failed to copy file: " + e.getMessage());
        }
    }

    /**
     * Rename file = copy + delete
     */
    public void renameFile(String oldKey, String newKey) {
        copyFile(oldKey, newKey);
        deleteFile(oldKey);
        log.info("Renamed S3 object from {} to {}", oldKey, newKey);
    }

    /**
     * Rename folder = iterate + copy + delete for each object
     */
    public void renameFolder(String oldPrefix, String newPrefix) {
        if (!oldPrefix.endsWith("/")) oldPrefix = oldPrefix + "/";
        if (!newPrefix.endsWith("/")) newPrefix = newPrefix + "/";

        ListObjectsV2Request listRequest = ListObjectsV2Request.builder()
                .bucket(bucketName)
                .prefix(oldPrefix)
                .build();

        ListObjectsV2Response listResponse;
        List<String> keysToDelete = new ArrayList<>();

        do {
            listResponse = s3Client.listObjectsV2(listRequest);
            for (software.amazon.awssdk.services.s3.model.S3Object obj : listResponse.contents()) {
                String newKey = obj.key().replaceFirst("^" + oldPrefix.replace("/", "\\/"), newPrefix);
                s3Client.copyObject(CopyObjectRequest.builder()
                        .sourceBucket(bucketName)
                        .sourceKey(obj.key())
                        .destinationBucket(bucketName)
                        .destinationKey(newKey)
                        .build());
                keysToDelete.add(obj.key());
            }
            listRequest = listRequest.toBuilder()
                    .continuationToken(listResponse.nextContinuationToken())
                    .build();
        } while (listResponse.isTruncated());

        // Delete old objects after all copies succeed
        for (String key : keysToDelete) {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build());
        }

        log.info("Renamed S3 folder from {} to {} ({} objects)", oldPrefix, newPrefix, keysToDelete.size());
    }

    /**
     * Get storage statistics from DB tracking
     */
    public Map<String, Object> getStorageStats() {
        Long totalSize = s3ObjectRepository.getTotalSizeBytes();
        List<Map<String, Object>> metadata = s3ObjectRepository.getAllObjectMetadata();
        
        Map<String, Long> byCategory = new java.util.HashMap<>();
        for (Map<String, Object> item : metadata) {
            String key = (String) item.get("key");
            Long size = (Long) item.get("size");
            String ext = "";
            int i = key.lastIndexOf(".");
            if (i > 0) ext = key.substring(i).toLowerCase();
            
            String cat = "other";
            if (List.of(".tif", ".tiff", ".geotiff").contains(ext)) cat = "geotiff";
            else if (List.of(".sql", ".sql.gz").contains(ext)) cat = "backup";
            else if (List.of(".xlsx", ".xls", ".csv").contains(ext)) cat = "spreadsheet";
            else if (List.of(".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp").contains(ext)) cat = "image";
            else if (List.of(".pdf", ".doc", ".docx", ".txt").contains(ext)) cat = "document";
            else if (List.of(".zip", ".tar", ".gz", ".rar", ".7z").contains(ext)) cat = "archive";
            else if (List.of(".json", ".xml", ".yaml", ".yml").contains(ext)) cat = "data";
            
            byCategory.put(cat, byCategory.getOrDefault(cat, 0L) + size);
        }

        Map<String, Object> stats = new java.util.HashMap<>();
        stats.put("totalSize", totalSize != null ? totalSize : 0L);
        stats.put("fileCount", metadata.size());
        stats.put("byCategory", byCategory);
        return stats;
    }

    /**
     * Generate file URL
     */
    public String getFileUrl(String key) {
        return String.format("https://backup.hci.vn/%s/%s", bucketName, key);
    }

    /**
     * Generate a signed URL for downloading an object.
     */
    public String createSignedGetUrl(String key, Duration expiresIn) {
        GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                .bucket(bucketName)
                .key(key)
                .build();

        GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(expiresIn)
                .getObjectRequest(getObjectRequest)
                .build();

        PresignedGetObjectRequest presignedRequest = s3Presigner.presignGetObject(presignRequest);
        return presignedRequest.url().toString();
    }
    
    /**
     * Check if file exists
     */
    public boolean fileExists(String key) {
        try {
            HeadObjectRequest headObjectRequest = HeadObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();
            
            s3Client.headObject(headObjectRequest);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (S3Exception e) {
            log.error("Failed to check file existence: {}", e.getMessage());
            return false;
        }
    }
}
