package com.mekongsaltlab.org.repository.gis;

import com.mekongsaltlab.org.entity.gis.Station;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface StationRepository extends JpaRepository<Station, Long> {
    Optional<Station> findByStationCode(String stationCode);
    List<Station> findByIsActiveTrue();
    List<Station> findByProvince(String province);
}
