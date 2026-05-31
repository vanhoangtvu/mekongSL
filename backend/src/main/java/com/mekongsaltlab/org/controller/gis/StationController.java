package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.StationCreateRequest;
import com.mekongsaltlab.org.dto.gis.StationResponse;
import com.mekongsaltlab.org.dto.gis.StationUpdateRequest;
import com.mekongsaltlab.org.entity.gis.Station;
import com.mekongsaltlab.org.repository.gis.StationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/gis/stations")
@RequiredArgsConstructor
public class StationController {

    private final StationRepository stationRepository;

    @GetMapping
    public ResponseEntity<List<StationResponse>> list() {
        return ResponseEntity.ok(stationRepository.findByIsActiveTrue()
            .stream().map(this::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/{code}")
    public ResponseEntity<StationResponse> getByCode(@PathVariable String code) {
        var station = stationRepository.findByStationCode(code).orElse(null);
        if (station == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toResponse(station));
    }

    @PostMapping
    public ResponseEntity<StationResponse> create(@RequestBody StationCreateRequest request) {
        if (stationRepository.findByStationCode(request.getStationCode()).isPresent()) {
            return ResponseEntity.badRequest().build();
        }
        Station station = new Station();
        station.setStationCode(request.getStationCode());
        station.setName(request.getName());
        station.setNameEn(request.getNameEn());
        station.setDescription(request.getDescription());
        station.setLatitude(request.getLatitude());
        station.setLongitude(request.getLongitude());
        station.setProvince(request.getProvince());
        station.setProvinceCode(request.getProvinceCode());
        station.setIsActive(true);
        station.setCreatedAt(Instant.now());
        return ResponseEntity.ok(toResponse(stationRepository.save(station)));
    }

    @PutMapping("/{code}")
    public ResponseEntity<StationResponse> update(@PathVariable String code, @RequestBody StationUpdateRequest request) {
        var station = stationRepository.findByStationCode(code).orElse(null);
        if (station == null) {
            return ResponseEntity.notFound().build();
        }
        if (request.getName() != null) station.setName(request.getName());
        if (request.getNameEn() != null) station.setNameEn(request.getNameEn());
        if (request.getDescription() != null) station.setDescription(request.getDescription());
        if (request.getLatitude() != null) station.setLatitude(request.getLatitude());
        if (request.getLongitude() != null) station.setLongitude(request.getLongitude());
        if (request.getProvince() != null) station.setProvince(request.getProvince());
        if (request.getProvinceCode() != null) station.setProvinceCode(request.getProvinceCode());
        station.setUpdatedAt(Instant.now());
        return ResponseEntity.ok(toResponse(stationRepository.save(station)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        var station = stationRepository.findById(id).orElse(null);
        if (station == null) {
            return ResponseEntity.notFound().build();
        }
        station.setIsActive(false);
        station.setUpdatedAt(Instant.now());
        stationRepository.save(station);
        return ResponseEntity.noContent().build();
    }

    private StationResponse toResponse(Station station) {
        StationResponse r = new StationResponse();
        r.setId(station.getId());
        r.setStationCode(station.getStationCode());
        r.setName(station.getName());
        r.setNameEn(station.getNameEn());
        r.setDescription(station.getDescription());
        r.setLatitude(station.getLatitude());
        r.setLongitude(station.getLongitude());
        r.setProvince(station.getProvince());
        r.setProvinceCode(station.getProvinceCode());
        r.setIsActive(station.getIsActive());
        r.setCreatedAt(station.getCreatedAt());
        r.setUpdatedAt(station.getUpdatedAt());
        return r;
    }
}
