package com.mekongsaltlab.org.dto.gis;

import lombok.Data;
import java.time.Instant;
import java.util.List;

@Data
public class LayerFolderDto {
    private Long id;
    private Long layerId;
    private Long parentId;
    private String name;
    private String logicalPath;
    private Instant createdAt;
    private List<LayerFolderDto> children;
}
