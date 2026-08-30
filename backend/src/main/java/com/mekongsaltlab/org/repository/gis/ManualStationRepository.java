package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.ManualStation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ManualStationRepository extends JpaRepository<ManualStation, Long> {
    List<ManualStation> findByIsActiveTrue();
    List<ManualStation> findByStationTypeAndIsActiveTrue(String stationType);
    
    // New methods for AI service
    List<ManualStation> findByStationIdIn(List<String> stationIds);
    List<ManualStation> findByStationType(String stationType);
}
