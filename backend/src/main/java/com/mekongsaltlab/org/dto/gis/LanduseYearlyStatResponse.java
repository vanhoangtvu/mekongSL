package com.mekongsaltlab.org.dto.gis;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LanduseYearlyStatResponse {
    private Long id;
    private String landuseKey;
    private Integer year;
    private Double areaHa;
    private Long classPixels;
    private Long totalPixels;
    private Double percentage;
    private Integer imageWidth;
    private Integer imageHeight;
    private Double pixelAreaM2;
    private String s3Key;
    private Instant computedAt;
}
