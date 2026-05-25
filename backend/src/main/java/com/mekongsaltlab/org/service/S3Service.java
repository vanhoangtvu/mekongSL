package com.mekongsaltlab.org.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import com.mekongsaltlab.org.dto.S3FileResponse;

import java.io.IOException;
import java.io.InputStream;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class S3Service {
    
    private final S3Client s3Client;
    
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
     * Generate file URL
     */
    public String getFileUrl(String key) {
        return String.format("https://backup.hci.vn/%s/%s", bucketName, key);
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
