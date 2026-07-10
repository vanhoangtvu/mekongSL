package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.entity.gis.LanduseYearlyStat;
import com.mekongsaltlab.org.service.gis.LanduseYearlyStatService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/gis")
@RequiredArgsConstructor
public class LanduseYearlyStatController {

    private final LanduseYearlyStatService service;

    @GetMapping("/landuse-yearly-stats")
    public ResponseEntity<List<Map<String, Object>>> getStats(@RequestParam("key") String landuseKey) {
        List<LanduseYearlyStat> stats = service.getByLanduseKey(landuseKey);
        List<Map<String, Object>> result = stats.stream()
                .map(s -> Map.<String, Object>of("year", s.getYear(), "areaHa", s.getAreaHa()))
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @PostMapping("/landuse-yearly-stats")
    public ResponseEntity<Map<String, Object>> saveStat(@RequestBody Map<String, Object> body) {
        String landuseKey = (String) body.get("landuseKey");
        int year = ((Number) body.get("year")).intValue();
        double areaHa = ((Number) body.get("areaHa")).doubleValue();

        LanduseYearlyStat saved = service.saveOrUpdate(landuseKey, year, areaHa);
        return ResponseEntity.ok(Map.of(
                "id", saved.getId(),
                "landuseKey", saved.getLanduseKey(),
                "year", saved.getYear(),
                "areaHa", saved.getAreaHa()
        ));
    }

    @PostMapping("/landuse-yearly-stats/batch")
    public ResponseEntity<Void> batchSave(@RequestBody Map<String, Object> body) {
        String landuseKey = (String) body.get("landuseKey");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> entries = (List<Map<String, Object>>) body.get("entries");
        service.batchSave(landuseKey, entries);
        return ResponseEntity.noContent().build();
    }
}
