package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.time.Instant;

@Data
public class LayerObjectResponse {
    private Long id;
    private Long layerId;
    private Long objectId;
    private String role;
    private String s3Key;
    private Long sizeBytes;
    private String contentType;
    private Instant createdAt;
}
