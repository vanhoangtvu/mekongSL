package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.time.Instant;

@Data
public class DatasetResponse {
    private Long id;
    private String name;
    private String description;
    private Long ownerId;
    private Instant createdAt;
    private Instant updatedAt;
}
