package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.time.Instant;

@Data
public class MonitoringDataResponse {
    private Long id;
    private Long monitoringStationId;
    private String monitoringCode;
    private String monitoringName;
    private String parameter;
    private Integer dataYear;
    private Integer dataMonth;
    private Integer dataDay;
    private String s3Key;
    private Long sizeBytes;
    private String fileFormat;
    private Integer recordCount;
    private Instant createdAt;
}
