package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

@Data
public class DatasetUpdateRequest {
    private String name;
    private String slug;
    private String description;
}
