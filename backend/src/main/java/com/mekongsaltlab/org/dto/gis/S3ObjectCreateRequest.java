package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

@Data
public class S3ObjectCreateRequest {
    private String s3Key;
    private Long sizeBytes;
    private String contentType;
    private String etag;
    private String checksumSha256;
    private String storageClass;
    private String versionId;
    private String role;
}
