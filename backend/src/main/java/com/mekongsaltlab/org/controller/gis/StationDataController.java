package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.SignedUrlResponse;
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
        @RequestParam(defaultValue = "default") String stationDataType,
        @RequestParam String stationCode,
        @RequestParam String parameter,
        @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date,
        @RequestParam(defaultValue = "00-00") String time,
        @RequestParam("file") MultipartFile file
    ) {
        try {
            StationDataResponse response = stationDataService.uploadData(
                stationDataType, stationCode, parameter, file, date, time);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IOException e) {
            return ResponseEntity.internalServerError().body("Failed to upload file: " + e.getMessage());
        }
    }

    @GetMapping
    public ResponseEntity<List<StationDataResponse>> listAll() {
        return ResponseEntity.ok(/* all station data - not implemented for now */ List.of());
    }

    @GetMapping("/{id}")
    public ResponseEntity<StationDataResponse> getById(@PathVariable Long id) {
        StationDataResponse response = stationDataService.getById(id);
        if (response == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(response);
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

    @GetMapping("/{id}/download")
    public ResponseEntity<SignedUrlResponse> download(@PathVariable Long id,
                                                      @RequestParam(defaultValue = "300") long expires) {
        SignedUrlResponse response = stationDataService.getSignedUrl(id, expires);
        if (response == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!stationDataService.deleteById(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
