package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.util.List;

@Data
public class StorageRuleSegmentResponse {
    private Long id;
    private Integer sortOrder;
    private String source;
    private String staticValue;
    private List<String> optionValues;
    private String dynamicSource;
    private String displayName;
    private String placeholder;
    private List<String> dynamicOptions;
}
