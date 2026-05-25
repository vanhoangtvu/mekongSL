package com.mekongsaltlab.org.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class S3FileResponse {
    private String key;
    private long size;
    private String lastModified;
}
