package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.MonitoringStationCreateRequest;
import com.mekongsaltlab.org.dto.gis.MonitoringStationResponse;
import com.mekongsaltlab.org.dto.gis.MonitoringStationUpdateRequest;
import com.mekongsaltlab.org.entity.gis.MonitoringStation;
import com.mekongsaltlab.org.repository.gis.MonitoringStationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/gis/monitoring-stations")
@RequiredArgsConstructor
public class MonitoringStationController {

    private final MonitoringStationRepository monitoringStationRepository;

    @GetMapping
    public ResponseEntity<List<MonitoringStationResponse>> list() {
        return ResponseEntity.ok(monitoringStationRepository.findByIsActiveTrue()
            .stream().map(this::toResponse).collect(Collectors.toList()));
    }

    @GetMapping("/{code}")
    public ResponseEntity<MonitoringStationResponse> getByCode(@PathVariable String code) {
        var station = monitoringStationRepository.findByMonitoringCode(code).orElse(null);
        if (station == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(toResponse(station));
    }

    @PostMapping
    public ResponseEntity<MonitoringStationResponse> create(@RequestBody MonitoringStationCreateRequest request) {
        if (monitoringStationRepository.findByMonitoringCode(request.getMonitoringCode()).isPresent()) {
            return ResponseEntity.badRequest().build();
        }
        MonitoringStation station = new MonitoringStation();
        station.setMonitoringCode(request.getMonitoringCode());
        station.setName(request.getName());
        station.setDescription(request.getDescription());
        station.setLatitude(request.getLatitude());
        station.setLongitude(request.getLongitude());
        station.setProvince(request.getProvince());
        station.setDeviceId(request.getDeviceId());
        station.setSource(request.getSource());
        station.setIsActive(true);
        station.setCreatedAt(Instant.now());
        return ResponseEntity.ok(toResponse(monitoringStationRepository.save(station)));
    }

    @PutMapping("/{code}")
    public ResponseEntity<MonitoringStationResponse> update(@PathVariable String code, @RequestBody MonitoringStationUpdateRequest request) {
        var station = monitoringStationRepository.findByMonitoringCode(code).orElse(null);
        if (station == null) {
            return ResponseEntity.notFound().build();
        }
        if (request.getName() != null) station.setName(request.getName());
        if (request.getDescription() != null) station.setDescription(request.getDescription());
        if (request.getLatitude() != null) station.setLatitude(request.getLatitude());
        if (request.getLongitude() != null) station.setLongitude(request.getLongitude());
        if (request.getProvince() != null) station.setProvince(request.getProvince());
        if (request.getDeviceId() != null) station.setDeviceId(request.getDeviceId());
        if (request.getSource() != null) station.setSource(request.getSource());
        station.setUpdatedAt(Instant.now());
        return ResponseEntity.ok(toResponse(monitoringStationRepository.save(station)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        var station = monitoringStationRepository.findById(id).orElse(null);
        if (station == null) {
            return ResponseEntity.notFound().build();
        }
        station.setIsActive(false);
        station.setUpdatedAt(Instant.now());
        monitoringStationRepository.save(station);
        return ResponseEntity.noContent().build();
    }

    private MonitoringStationResponse toResponse(MonitoringStation station) {
        MonitoringStationResponse r = new MonitoringStationResponse();
        r.setId(station.getId());
        r.setMonitoringCode(station.getMonitoringCode());
        r.setName(station.getName());
        r.setDescription(station.getDescription());
        r.setLatitude(station.getLatitude());
        r.setLongitude(station.getLongitude());
        r.setProvince(station.getProvince());
        r.setDeviceId(station.getDeviceId());
        r.setSource(station.getSource());
        r.setIsActive(station.getIsActive());
        r.setCreatedAt(station.getCreatedAt());
        r.setUpdatedAt(station.getUpdatedAt());
        return r;
    }
}
