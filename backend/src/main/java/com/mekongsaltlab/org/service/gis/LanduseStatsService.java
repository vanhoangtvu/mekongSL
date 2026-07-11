package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.dto.gis.LanduseYearlyStatResponse;
import com.mekongsaltlab.org.entity.gis.LanduseYearlyStats;
import com.mekongsaltlab.org.repository.gis.LanduseYearlyStatsRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LanduseStatsService {

    private final LanduseYearlyStatsRepository statsRepository;

    public List<LanduseYearlyStatResponse> getYearlyStats(String landuseKey) {
        return statsRepository.findByLanduseKeyOrderByYearAsc(landuseKey)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    private LanduseYearlyStatResponse toResponse(LanduseYearlyStats entity) {
        LanduseYearlyStatResponse resp = new LanduseYearlyStatResponse();
        resp.setId(entity.getId());
        resp.setLanduseKey(entity.getLanduseKey());
        resp.setYear(entity.getYear());
        resp.setAreaHa(entity.getAreaHa());
        resp.setClassPixels(entity.getClassPixels());
        resp.setTotalPixels(entity.getTotalPixels());
        resp.setPercentage(entity.getPercentage());
        resp.setImageWidth(entity.getImageWidth());
        resp.setImageHeight(entity.getImageHeight());
        resp.setPixelAreaM2(entity.getPixelAreaM2());
        resp.setS3Key(entity.getS3Key());
        resp.setComputedAt(entity.getComputedAt());
        return resp;
    }
}
