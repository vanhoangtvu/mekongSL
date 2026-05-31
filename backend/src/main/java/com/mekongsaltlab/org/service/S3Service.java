package com.mekongsaltlab.org.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import com.mekongsaltlab.org.dto.S3FileResponse;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class S3Service {
    
    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    
    @Value("${s3.bucket}")
    private String bucketName;
    
    /**
     * Upload file to S3
     */
    public String uploadFile(String key, MultipartFile file) throws IOException {
        try {
            PutObjectRequest putObjectRequest = PutObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .contentType(file.getContentType())
                    .build();
            
            s3Client.putObject(putObjectRequest, RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
            
            log.info("Uploaded file to S3: {}", key);
            return key;
        } catch (S3Exception e) {
            log.error("Failed to upload file to S3: {}", e.getMessage());
            throw new RuntimeException("Failed to upload file: " + e.getMessage());
        }
    }
    
    /**
     * Upload file with auto-generated key (timestamp-based)
     */
    public String uploadFile(MultipartFile file) throws IOException {
        String timestamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String originalFilename = file.getOriginalFilename();
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
            log.error("Failed to upload file to S3: {}", e.getMessage());
            throw new RuntimeException("Failed to upload file: " + e.getMessage());
        }
    }
    
    /**
     * Download file from S3
     */
    public InputStream downloadFile(String key) {
        try {
            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();
            
            return s3Client.getObject(getObjectRequest);
        } catch (S3Exception e) {
            log.error("Failed to download file from S3: {}", e.getMessage());
            throw new RuntimeException("Failed to download file: " + e.getMessage());
        }
    }
    
    /**
     * Delete file from S3
     */
    public void deleteFile(String key) {
        try {
            DeleteObjectRequest deleteObjectRequest = DeleteObjectRequest.builder()
                    .bucket(bucketName)
                    .key(key)
                    .build();
            
            s3Client.deleteObject(deleteObjectRequest);
            log.info("Deleted file from S3: {}", key);
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
            for (S3Object obj : listResponse.contents()) {
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
