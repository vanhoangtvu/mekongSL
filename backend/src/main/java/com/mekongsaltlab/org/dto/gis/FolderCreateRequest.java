package com.mekongsaltlab.org.dto.gis;

import lombok.Data;

@Data
public class FolderCreateRequest {
    private Long layerId;
    private Long parentId;
    private String name;
}
