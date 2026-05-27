package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

@Data
public class DatasetCreateRequest {
    private String name;
    private String description;
    private Long ownerId;
}
