package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.util.Map;

@Data
public class PathResolveRequest {
    private Long ruleId;
    private Map<String, String> selections;
}
