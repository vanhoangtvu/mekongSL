package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

import java.time.Instant;

@Data
public class SignedUrlResponse {
    private String url;
    private Instant expiresAt;
}
