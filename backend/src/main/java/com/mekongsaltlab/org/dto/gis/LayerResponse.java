package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.time.Instant;

@Data
public class LayerResponse {
    private Long id;
    private Long datasetId;
    private String category;
    private Integer year;
    private String gisDataType;
    private String name;
    private String description;
    private String layerType;
    private String dataClass;
    private String status;
    private Long ownerId;
    private Instant createdAt;
    private Instant updatedAt;

    private Double bboxMinLon;
    private Double bboxMinLat;
    private Double bboxMaxLon;
    private Double bboxMaxLat;

    private Integer epsgCode;
    private String rasterType;
    private String vectorType;
    private Double resolutionX;
    private Double resolutionY;
    private Instant obsTimeStart;
    private Instant obsTimeEnd;
    private String province;
    private String station;
    private String source;
}
