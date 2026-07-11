package com.mekongsaltlab.org.dto.gis;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LanduseInventoryItem {
    private String landuseKey;
    private String landuseName;
    private List<Integer> s3Years;
    private List<Integer> computedYears;
    private boolean needsCompute;
}
