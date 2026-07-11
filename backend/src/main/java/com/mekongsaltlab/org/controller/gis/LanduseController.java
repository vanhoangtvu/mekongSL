package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.dto.gis.ComputeStatusResponse;
import com.mekongsaltlab.org.dto.gis.InventoryResponse;
import com.mekongsaltlab.org.dto.gis.LanduseComputeRequest;
import com.mekongsaltlab.org.dto.gis.LanduseYearlyStatResponse;
import com.mekongsaltlab.org.entity.gis.LanduseComputationJob;
import com.mekongsaltlab.org.service.gis.LanduseComputeService;
import com.mekongsaltlab.org.service.gis.LanduseStatsService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class LanduseController {

    private final LanduseStatsService statsService;
    private final LanduseComputeService computeService;

    @GetMapping("/api/gis/landuse-yearly-stats")
    public ResponseEntity<List<LanduseYearlyStatResponse>> getYearlyStats(
            @RequestParam("key") String landuseKey) {
        List<LanduseYearlyStatResponse> stats = statsService.getYearlyStats(landuseKey);
        return ResponseEntity.ok(stats);
    }

    @PostMapping("/api/gis/landuse/compute")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<Map<String, Object>> triggerCompute(
            @RequestBody(required = false) LanduseComputeRequest request,
            Authentication auth) {
        boolean incremental = request != null && request.isIncremental();
        String username = auth != null ? auth.getName() : "system";
        LanduseComputationJob job = computeService.triggerCompute(username, incremental);
        return ResponseEntity.ok(Map.of(
                "jobId", job.getId(),
                "status", job.getStatus().name(),
                "message", "Computation started"
        ));
    }

    @GetMapping("/api/gis/landuse/compute-status")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<ComputeStatusResponse> getStatus() {
        return ResponseEntity.ok(computeService.getStatus());
    }

    @GetMapping("/api/gis/landuse/inventory")
    @PreAuthorize("hasAnyRole('ADMIN', 'DATA_MANAGER')")
    public ResponseEntity<InventoryResponse> getInventory() {
        return ResponseEntity.ok(computeService.getInventory());
    }
}
