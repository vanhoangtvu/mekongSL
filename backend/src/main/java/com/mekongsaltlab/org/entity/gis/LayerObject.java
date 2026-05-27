package com.mekongsaltlab.org.entity.gis;

import com.mekongsaltlab.org.entity.gis.enums.ObjectRole;
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
@Table(name = "layer_object")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LayerObject {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "layer_id", nullable = false)
    private Layer layer;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "folder_id")
    private LayerFolder folder;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "s3_object_id", nullable = false)
    private S3Object s3Object;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ObjectRole role;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();
}
