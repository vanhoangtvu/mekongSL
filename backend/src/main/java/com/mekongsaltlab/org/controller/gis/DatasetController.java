package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.DatasetCreateRequest;
import com.mekongsaltlab.org.dto.gis.DatasetResponse;
import com.mekongsaltlab.org.dto.gis.DatasetUpdateRequest;
import com.mekongsaltlab.org.service.gis.DatasetService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/gis/datasets")
@RequiredArgsConstructor
public class DatasetController {

    private final DatasetService datasetService;

    @GetMapping
    public ResponseEntity<Page<DatasetResponse>> list(Pageable pageable) {
        return ResponseEntity.ok(datasetService.list(pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<DatasetResponse> get(@PathVariable Long id) {
        DatasetResponse response = datasetService.getById(id);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping
    public ResponseEntity<DatasetResponse> create(@RequestBody DatasetCreateRequest request) {
        DatasetResponse response = datasetService.create(request);
        return ResponseEntity.ok(response);
    }

    @PatchMapping("/{id}")
    public ResponseEntity<DatasetResponse> update(@PathVariable Long id, @RequestBody DatasetUpdateRequest request) {
        DatasetResponse response = datasetService.update(id, request);
        if (response == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        if (!datasetService.softDelete(id)) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.noContent().build();
    }
}
