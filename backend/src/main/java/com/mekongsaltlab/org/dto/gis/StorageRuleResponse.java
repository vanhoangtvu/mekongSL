package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.util.List;

@Data
public class StorageRuleResponse {
    private Long id;
    private String name;
    private String description;
    private String icon;
    private Boolean isActive;
    private List<StorageRuleSegmentResponse> segments;
}
