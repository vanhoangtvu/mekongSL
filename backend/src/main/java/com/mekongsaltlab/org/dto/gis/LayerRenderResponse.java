package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

@Data
public class LayerRenderResponse {
    private Long id;
    private String name;
    private String layerType;
    private String dataClass;
    private String status;

    private Double bboxMinLon;
    private Double bboxMinLat;
    private Double bboxMaxLon;
    private Double bboxMaxLat;

    private Integer epsgCode;
    private String source;

    private Long objectId;
    private String s3Key;
    private String signedUrl;
}
