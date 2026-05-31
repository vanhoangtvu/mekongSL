package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.MonitoringDataResponse;
import com.mekongsaltlab.org.service.gis.MonitoringDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/gis/monitoring-data")
@RequiredArgsConstructor
public class MonitoringDataController {

    private final MonitoringDataService monitoringDataService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadData(
        @RequestParam String monitoringCode,
        @RequestParam String parameter,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
        @RequestParam("file") MultipartFile file
    ) {
        try {
            MonitoringDataResponse response = monitoringDataService.uploadData(monitoringCode, parameter, file, date);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("Failed to upload file: " + e.getMessage());
        }
    }

    @GetMapping("/list/{monitoringCode}")
    public ResponseEntity<List<MonitoringDataResponse>> listData(
        @PathVariable String monitoringCode,
        @RequestParam(required = false) String parameter
    ) {
        if (parameter != null) {
            return ResponseEntity.ok(monitoringDataService.listData(monitoringCode, parameter));
        }
        return ResponseEntity.ok(monitoringDataService.listAllData(monitoringCode));
    }
}
