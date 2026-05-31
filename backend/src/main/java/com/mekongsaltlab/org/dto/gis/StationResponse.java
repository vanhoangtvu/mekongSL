package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.time.Instant;

@Data
public class StationResponse {
    private Long id;
    private String stationCode;
    private String name;
    private String nameEn;
    private String description;
    private Double latitude;
    private Double longitude;
    private String province;
    private String provinceCode;
    private Boolean isActive;
    private Instant createdAt;
    private Instant updatedAt;
}
