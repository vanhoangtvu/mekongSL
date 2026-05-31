package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.StationDataResponse;
import com.mekongsaltlab.org.service.gis.StationDataService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/gis/station-data")
@RequiredArgsConstructor
public class StationDataController {

    private final StationDataService stationDataService;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadData(
        @RequestParam String stationCode,
        @RequestParam String parameter,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
        @RequestParam("file") MultipartFile file
    ) {
        try {
            StationDataResponse response = stationDataService.uploadData(stationCode, parameter, file, date);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("Failed to upload file: " + e.getMessage());
        }
    }

    @GetMapping("/list/{stationCode}")
    public ResponseEntity<List<StationDataResponse>> listData(
        @PathVariable String stationCode,
        @RequestParam(required = false) String parameter
    ) {
        if (parameter != null) {
            return ResponseEntity.ok(stationDataService.listData(stationCode, parameter));
        }
        return ResponseEntity.ok(stationDataService.listAllData(stationCode));
    }
}
