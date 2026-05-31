package com.mekongsaltlab.org.entity.gis;

import com.mekongsaltlab.org.entity.gis.enums.DataClassType;
import com.mekongsaltlab.org.entity.gis.enums.GisDataType;
import com.mekongsaltlab.org.entity.gis.enums.LayerStatus;
import com.mekongsaltlab.org.entity.gis.enums.LayerType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.Instant;

@Entity
@Table(name = "layer")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Layer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "dataset_id", nullable = false)
    private Dataset dataset;

    @Column
    private String category;

    @Column
    private Integer year;

    @Enumerated(EnumType.STRING)
    @Column(name = "gis_data_type")
    private GisDataType gisDataType;

    @Column(nullable = false)
    private String name;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(name = "layer_type", nullable = false)
    private LayerType layerType;

    @Enumerated(EnumType.STRING)
    @Column(name = "data_class", nullable = false)
    private DataClassType dataClass;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private LayerStatus status;

    @Column(name = "owner_id", nullable = false)
    private Long ownerId;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "min_lon")
    private Double minLon;

    @Column(name = "min_lat")
    private Double minLat;

    @Column(name = "max_lon")
    private Double maxLon;

    @Column(name = "max_lat")
    private Double maxLat;

    @Column(name = "epsg_code")
    private Integer epsgCode;

    @Column(name = "raster_type")
    private String rasterType;

    @Column(name = "vector_type")
    private String vectorType;

    @Column(name = "resolution_x")
    private Double resolutionX;

    @Column(name = "resolution_y")
    private Double resolutionY;

    @Column(name = "obs_time_start")
    private Instant obsTimeStart;

    @Column(name = "obs_time_end")
    private Instant obsTimeEnd;

    private String province;

    private String station;

    private String source;
}
