package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.MonitoringDataFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MonitoringDataFileRepository extends JpaRepository<MonitoringDataFile, Long> {
    Optional<MonitoringDataFile> findByMonitoringStationIdAndParameterAndDataYearAndDataMonthAndDataDay(
        Long monitoringStationId, String parameter, int year, int month, int day);
    List<MonitoringDataFile> findByMonitoringStationIdAndParameterOrderByDataYearDescDataMonthDescDataDayDesc(
        Long monitoringStationId, String parameter);
    List<MonitoringDataFile> findByMonitoringStationId(Long monitoringStationId);
}
