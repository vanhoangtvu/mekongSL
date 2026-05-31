package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

@Data
public class StationUpdateRequest {
    private String name;
    private String nameEn;
    private String description;
    private Double latitude;
    private Double longitude;
    private String province;
    private String provinceCode;
}
