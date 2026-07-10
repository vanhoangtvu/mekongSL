package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.entity.gis.LanduseYearlyStat;
import com.mekongsaltlab.org.repository.gis.LanduseYearlyStatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LanduseYearlyStatService {

    private final LanduseYearlyStatRepository repository;

    @Transactional(readOnly = true)
    public List<LanduseYearlyStat> getByLanduseKey(String landuseKey) {
        return repository.findByLanduseKeyOrderByYearAsc(landuseKey);
    }

    @Transactional
    public LanduseYearlyStat saveOrUpdate(String landuseKey, int year, double areaHa) {
        return repository.findByLanduseKeyAndYear(landuseKey, year)
                .map(existing -> {
                    existing.setAreaHa(areaHa);
                    return repository.save(existing);
                })
                .orElseGet(() -> {
                    LanduseYearlyStat stat = new LanduseYearlyStat();
                    stat.setLanduseKey(landuseKey);
                    stat.setYear(year);
                    stat.setAreaHa(areaHa);
                    return repository.save(stat);
                });
    }

    @Transactional
    public void batchSave(String landuseKey, List<Map<String, Object>> entries) {
        for (Map<String, Object> entry : entries) {
            int year = ((Number) entry.get("year")).intValue();
            double areaHa = ((Number) entry.get("areaHa")).doubleValue();
            saveOrUpdate(landuseKey, year, areaHa);
        }
    }

    public boolean exists(String landuseKey, int year) {
        return repository.existsByLanduseKeyAndYear(landuseKey, year);
    }
}
