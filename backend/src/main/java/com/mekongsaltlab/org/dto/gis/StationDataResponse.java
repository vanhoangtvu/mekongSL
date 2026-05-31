package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.time.Instant;

@Data
public class StationDataResponse {
    private Long id;
    private Long stationId;
    private String stationCode;
    private String stationName;
    private String parameter;
    private Integer dataYear;
    private Integer dataMonth;
    private Integer dataDay;
    private String s3Key;
    private Long sizeBytes;
    private String contentType;
    private String fileFormat;
    private Integer recordCount;
    private Instant createdAt;
}
