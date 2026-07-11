package com.mekongsaltlab.org.dto.gis;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.Map;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComputeStatusResponse {
    private Long jobId;
    private String status;
    private String triggeredBy;
    private Integer totalKeys;
    private Integer completedKeys;
    private Integer totalYears;
    private Integer completedYears;
    private String errorMessage;
    private Map<String, Map<String, String>> progressDetail;
    private Instant startedAt;
    private Instant completedAt;
    private Instant createdAt;
    private Instant updatedAt;
}
