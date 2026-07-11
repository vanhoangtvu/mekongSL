package com.mekongsaltlab.org.dto.gis;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LanduseComputeRequest {
    private boolean incremental = true;
}
