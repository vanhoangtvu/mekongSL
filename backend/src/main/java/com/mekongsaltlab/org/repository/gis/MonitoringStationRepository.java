package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.MonitoringStation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MonitoringStationRepository extends JpaRepository<MonitoringStation, Long> {
    Optional<MonitoringStation> findByMonitoringCode(String monitoringCode);
    List<MonitoringStation> findByIsActiveTrue();
    List<MonitoringStation> findBySource(String source);
}
