package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.LayerObject;
import org.springframework.data.jpa.repository.JpaRepository;

import com.mekongsaltlab.org.entity.gis.enums.ObjectRole;

import java.util.List;
import java.util.Optional;

public interface LayerObjectRepository extends JpaRepository<LayerObject, Long> {
    List<LayerObject> findByLayerId(Long layerId);
    Optional<LayerObject> findFirstByLayerIdAndRole(Long layerId, ObjectRole role);
    boolean existsByLayerIdAndS3ObjectIdAndRole(Long layerId, Long s3ObjectId, ObjectRole role);
    Optional<LayerObject> findFirstByLayerIdAndS3ObjectIdAndRole(Long layerId, Long s3ObjectId, ObjectRole role);
}
