package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.WaterQualitySample;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface WaterQualitySampleRepository extends JpaRepository<WaterQualitySample, Long> {

    @Query("SELECT s FROM WaterQualitySample s LEFT JOIN FETCH s.parameters JOIN FETCH s.station WHERE s.station.id = :stationId ORDER BY s.sampleDate DESC")
    List<WaterQualitySample> findByStationIdOrderBySampleDateDesc(@Param("stationId") Long stationId);

    @Query("SELECT s FROM WaterQualitySample s JOIN FETCH s.station WHERE s.station.id = :stationId AND s.sampleDate = :sampleDate")
    List<WaterQualitySample> findByStationIdAndSampleDate(@Param("stationId") Long stationId, @Param("sampleDate") LocalDate sampleDate);

    @Query("SELECT COUNT(s) > 0 FROM WaterQualitySample s WHERE s.station.id = :stationId AND s.sampleDate = :sampleDate")
    boolean existsByStationIdAndSampleDate(@Param("stationId") Long stationId, @Param("sampleDate") LocalDate sampleDate);

    @Query("SELECT COUNT(s) FROM WaterQualitySample s WHERE s.station.id = :stationId")
    long countByStationId(@Param("stationId") Long stationId);

    @Query(value = "SELECT * FROM water_quality_sample WHERE station_db_id = :stationId ORDER BY sample_date DESC", nativeQuery = true)
    List<WaterQualitySample> findByStationDbIdNative(@Param("stationId") Long stationId);

    @Query(value = "SELECT station_db_id FROM water_quality_sample ORDER BY id DESC LIMIT 1", nativeQuery = true)
    Long findLatestStationDbId();

    @Query("SELECT s FROM WaterQualitySample s JOIN FETCH s.station ORDER BY s.importedAt DESC, s.id DESC")
    List<WaterQualitySample> findAllOrderByImportedAtDesc();
    
    // New methods for AI service  
    @Query("SELECT s FROM WaterQualitySample s LEFT JOIN FETCH s.parameters WHERE s.station = :station AND s.sampleDate BETWEEN :startDate AND :endDate ORDER BY s.sampleDate")
    List<WaterQualitySample> findByStationAndSampleDateBetween(@Param("station") com.mekongsaltlab.org.entity.gis.ManualStation station, 
                                                                 @Param("startDate") LocalDate startDate, 
                                                                 @Param("endDate") LocalDate endDate);
}
