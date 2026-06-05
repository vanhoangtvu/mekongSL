package com.mekongsaltlab.org.entity.gis;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Entity
@Table(name = "manual_station")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManualStation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "station_id")
    private String stationId;

    @Column(name = "station_type", nullable = false)
    private String stationType; // 'groundwater' or 'surface_water'

    @Column(nullable = false)
    private String location; // ĐỊA ĐIỂM

    @Column(name = "hydro_char")
    private String hydroChar; // ĐẶC TÍNH THỦY VỰC

    private Double x; // X (Longitude)

    private Double y; // Y (Latitude)

    @Column(name = "image_code", length = 2000)
    private String imageCode; // HIỆN TRƯỜNG(CODE PICS)

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt;
}
