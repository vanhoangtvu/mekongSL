package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.StationDataFile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StationDataFileRepository extends JpaRepository<StationDataFile, Long> {
    Optional<StationDataFile> findByStationIdAndParameterAndDataYearAndDataMonthAndDataDay(
        Long stationId, String parameter, int year, int month, int day);
    List<StationDataFile> findByStationIdAndParameterOrderByDataYearDescDataMonthDescDataDayDesc(
        Long stationId, String parameter);
    List<StationDataFile> findByStationId(Long stationId);
}
