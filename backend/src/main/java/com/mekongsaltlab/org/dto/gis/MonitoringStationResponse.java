package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.time.Instant;

@Data
public class MonitoringStationResponse {
    private Long id;
    private String monitoringCode;
    private String name;
    private String description;
    private Double latitude;
    private Double longitude;
    private String province;
    private String deviceId;
    private String source;
    private Boolean isActive;
    private Instant createdAt;
    private Instant updatedAt;
}
