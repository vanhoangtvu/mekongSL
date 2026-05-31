package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.util.List;

@Data
public class PathResolveResponse {
    private String path;
    private List<String> segments;
    private List<SegmentResolved> resolvedSegments;

    @Data
    public static class SegmentResolved {
        private String label;
        private String value;
        private String source;
    }
}
