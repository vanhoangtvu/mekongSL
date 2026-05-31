package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

@Data
public class MonitoringStationUpdateRequest {
    private String name;
    private String description;
    private Double latitude;
    private Double longitude;
    private String province;
    private String deviceId;
    private String source;
}
