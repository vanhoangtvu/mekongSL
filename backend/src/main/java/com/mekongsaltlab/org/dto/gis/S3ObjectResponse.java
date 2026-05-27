package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.time.Instant;

@Data
public class S3ObjectResponse {
    private Long id;
    private String bucket;
    private String s3Key;
    private Long sizeBytes;
    private String contentType;
    private String etag;
    private String checksumSha256;
    private String storageClass;
    private String versionId;
    private Instant createdAt;
    private Instant uploadedAt;
}
