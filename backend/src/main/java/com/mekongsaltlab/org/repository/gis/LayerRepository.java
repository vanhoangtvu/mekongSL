package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.Layer;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;

public interface LayerRepository extends JpaRepository<Layer, Long> {

    @Query(
        value = "SELECT * FROM layer "
            + "WHERE is_deleted = false "
            + "AND (:datasetId IS NULL OR dataset_id = :datasetId) "
            + "AND (:status IS NULL OR status = :status) "
            + "AND (:layerType IS NULL OR layer_type = :layerType) "
            + "AND (:dataClass IS NULL OR data_class = :dataClass) "
            + "AND (:source IS NULL OR source = :source) "
            + "AND (:province IS NULL OR province = :province) "
            + "AND (:station IS NULL OR station = :station) "
            + "AND (:startTime IS NULL OR obs_time_end >= :startTime) "
            + "AND (:endTime IS NULL OR obs_time_start <= :endTime) "
            + "AND (:tagName IS NULL OR EXISTS ("
            + "  SELECT 1 FROM tag_link tl "
            + "  JOIN tag t ON t.id = tl.tag_id "
            + "  WHERE tl.entity_type = 'LAYER' "
            + "    AND tl.entity_id = layer.id "
            + "    AND t.name = :tagName"
            + "))",
        countQuery = "SELECT COUNT(*) FROM layer "
            + "WHERE is_deleted = false "
            + "AND (:datasetId IS NULL OR dataset_id = :datasetId) "
            + "AND (:status IS NULL OR status = :status) "
            + "AND (:layerType IS NULL OR layer_type = :layerType) "
            + "AND (:dataClass IS NULL OR data_class = :dataClass) "
            + "AND (:source IS NULL OR source = :source) "
            + "AND (:province IS NULL OR province = :province) "
            + "AND (:station IS NULL OR station = :station) "
            + "AND (:startTime IS NULL OR obs_time_end >= :startTime) "
            + "AND (:endTime IS NULL OR obs_time_start <= :endTime) "
            + "AND (:tagName IS NULL OR EXISTS ("
            + "  SELECT 1 FROM tag_link tl "
            + "  JOIN tag t ON t.id = tl.tag_id "
            + "  WHERE tl.entity_type = 'LAYER' "
            + "    AND tl.entity_id = layer.id "
            + "    AND t.name = :tagName"
            + "))",
        nativeQuery = true
    )
    Page<Layer> searchLayers(
        @Param("datasetId") Long datasetId,
        @Param("status") String status,
        @Param("layerType") String layerType,
        @Param("dataClass") String dataClass,
        @Param("source") String source,
        @Param("province") String province,
        @Param("station") String station,
        @Param("startTime") Instant startTime,
        @Param("endTime") Instant endTime,
        @Param("tagName") String tagName,
        Pageable pageable
    );

    @Query(
        value = "SELECT * FROM layer "
            + "WHERE is_deleted = false "
            + "AND (:datasetId IS NULL OR dataset_id = :datasetId) "
            + "AND (:status IS NULL OR status = :status) "
            + "AND (:layerType IS NULL OR layer_type = :layerType) "
            + "AND (:dataClass IS NULL OR data_class = :dataClass) "
            + "AND (:source IS NULL OR source = :source) "
            + "AND (:province IS NULL OR province = :province) "
            + "AND (:station IS NULL OR station = :station) "
            + "AND (:startTime IS NULL OR obs_time_end >= :startTime) "
            + "AND (:endTime IS NULL OR obs_time_start <= :endTime) "
            + "AND (:tagName IS NULL OR EXISTS ("
            + "  SELECT 1 FROM tag_link tl "
            + "  JOIN tag t ON t.id = tl.tag_id "
            + "  WHERE tl.entity_type = 'LAYER' "
            + "    AND tl.entity_id = layer.id "
            + "    AND t.name = :tagName"
            + ")) "
            + "AND NOT (max_lon < :minLon OR min_lon > :maxLon OR max_lat < :minLat OR min_lat > :maxLat)",
        countQuery = "SELECT COUNT(*) FROM layer "
            + "WHERE is_deleted = false "
            + "AND (:datasetId IS NULL OR dataset_id = :datasetId) "
            + "AND (:status IS NULL OR status = :status) "
            + "AND (:layerType IS NULL OR layer_type = :layerType) "
            + "AND (:dataClass IS NULL OR data_class = :dataClass) "
            + "AND (:source IS NULL OR source = :source) "
            + "AND (:province IS NULL OR province = :province) "
            + "AND (:station IS NULL OR station = :station) "
            + "AND (:startTime IS NULL OR obs_time_end >= :startTime) "
            + "AND (:endTime IS NULL OR obs_time_start <= :endTime) "
            + "AND (:tagName IS NULL OR EXISTS ("
            + "  SELECT 1 FROM tag_link tl "
            + "  JOIN tag t ON t.id = tl.tag_id "
            + "  WHERE tl.entity_type = 'LAYER' "
            + "    AND tl.entity_id = layer.id "
            + "    AND t.name = :tagName"
            + ")) "
            + "AND NOT (max_lon < :minLon OR min_lon > :maxLon OR max_lat < :minLat OR min_lat > :maxLat)",
        nativeQuery = true
    )
    Page<Layer> searchLayersWithBbox(
        @Param("datasetId") Long datasetId,
        @Param("status") String status,
        @Param("layerType") String layerType,
        @Param("dataClass") String dataClass,
        @Param("source") String source,
        @Param("province") String province,
        @Param("station") String station,
        @Param("startTime") Instant startTime,
        @Param("endTime") Instant endTime,
        @Param("tagName") String tagName,
        @Param("minLon") double minLon,
        @Param("minLat") double minLat,
        @Param("maxLon") double maxLon,
        @Param("maxLat") double maxLat,
        Pageable pageable
    );
}
