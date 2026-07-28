package com.mekongsaltlab.org.service.gis;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.mekongsaltlab.org.dto.gis.ComputeStatusResponse;
import com.mekongsaltlab.org.dto.gis.InventoryResponse;
import com.mekongsaltlab.org.dto.gis.LanduseInventoryItem;
import com.mekongsaltlab.org.entity.gis.LanduseComputationJob;
import com.mekongsaltlab.org.entity.gis.LanduseYearlyStats;
import com.mekongsaltlab.org.repository.gis.LanduseComputationJobRepository;
import com.mekongsaltlab.org.repository.gis.LanduseYearlyStatsRepository;
import com.mekongsaltlab.org.service.S3Service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.image.DataBufferFloat;
import java.awt.image.Raster;
import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
@Slf4j
public class LanduseComputeService {

    private static final String S3_LANDUSE_PREFIX = "gis-data/baseline-environment/landuse-classification/";
    private static final Pattern YEAR_PATTERN = Pattern.compile("/(\\d{4})/");
    private static final Pattern LU_KEY_PATTERN = Pattern.compile("landuse-classification/([^/]+)/");
    private static final double UTM48N_WIDTH_M = 93600.0;
    private static final double UTM48N_HEIGHT_M = 64800.0;

    private static final Map<String, String> LANDUSE_NAME_MAP = new LinkedHashMap<>();
    static {
        LANDUSE_NAME_MAP.put("landuse-classification/aquaculture", "Aquaculture and Water Surface Lands");
        LANDUSE_NAME_MAP.put("landuse-classification/rice-shrimp", "Rice-to-shrimp / Intensive shrimp farming");
        LANDUSE_NAME_MAP.put("landuse-classification/perennial-crops", "Perennial crops, Fruit Orchards and Mangrove Forests");
        LANDUSE_NAME_MAP.put("landuse-classification/residential-land", "Residential Land and Sandy Ridge Land");
        LANDUSE_NAME_MAP.put("landuse-classification/coconut-garden", "Coconut Plantation, mix garden");
        LANDUSE_NAME_MAP.put("landuse-classification/vegetable-crops", "Vegetable and Upland Crop Area");
        LANDUSE_NAME_MAP.put("landuse-classification/rice-cultivation", "Rice Cultivation Zone");
    }

    private final S3Service s3Service;
    private final LanduseYearlyStatsRepository statsRepository;
    private final LanduseComputationJobRepository jobRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public InventoryResponse getInventory() {
        Map<String, Map<Integer, String>> s3Inventory = scanS3ForLanduse();
        List<LanduseInventoryItem> items = new ArrayList<>();

        for (Map.Entry<String, String> entry : LANDUSE_NAME_MAP.entrySet()) {
            String luKey = entry.getKey();
            String luName = entry.getValue();
            Map<Integer, String> s3Years = s3Inventory.getOrDefault(luKey, new LinkedHashMap<>());

            List<LanduseYearlyStats> computed = statsRepository.findByLanduseKeyOrderByYearAsc(luKey);
            List<Integer> computedYears = computed.stream()
                    .map(LanduseYearlyStats::getYear)
                    .toList();

            boolean needsCompute = s3Years.keySet().stream()
                    .anyMatch(y -> !computedYears.contains(y));

            items.add(LanduseInventoryItem.builder()
                    .landuseKey(luKey)
                    .landuseName(luName)
                    .s3Years(new ArrayList<>(s3Years.keySet()))
                    .computedYears(computedYears)
                    .needsCompute(needsCompute)
                    .build());
        }

        return InventoryResponse.builder().items(items).build();
    }

    /**
     * Trigger full computation asynchronously. Returns the job ID immediately.
     */
    public LanduseComputationJob triggerCompute(String username, boolean incremental) {
        LanduseComputationJob job = new LanduseComputationJob();
        job.setStatus(LanduseComputationJob.Status.PENDING);
        job.setTriggeredBy(username);
        job = jobRepository.save(job);

        final Long jobId = job.getId();
        new Thread(() -> runComputeSync(jobId, incremental)).start();
        return job;
    }

    void runComputeSync(Long jobId, boolean incremental) {
        LanduseComputationJob job = jobRepository.findById(jobId).orElse(null);
        if (job == null) {
            log.error("Job {} not found", jobId);
            return;
        }

        try {
            job.setStatus(LanduseComputationJob.Status.RUNNING);
            job.setStartedAt(Instant.now());
            job = jobRepository.save(job);

            Map<String, Map<Integer, String>> s3Inventory = scanS3ForLanduse();
            List<String> luKeys = new ArrayList<>(LANDUSE_NAME_MAP.keySet());

            int totalYears = 0;
            Map<String, Map<String, String>> progress = new LinkedHashMap<>();

            for (String luKey : luKeys) {
                Map<Integer, String> yearMap = s3Inventory.getOrDefault(luKey, new LinkedHashMap<>());
                Map<String, String> luProgress = new LinkedHashMap<>();
                for (Map.Entry<Integer, String> ye : yearMap.entrySet()) {
                    luProgress.put(String.valueOf(ye.getKey()), "pending");
                }
                progress.put(luKey, luProgress);
                totalYears += yearMap.size();
            }

            job.setTotalKeys(luKeys.size());
            job.setTotalYears(totalYears);
            job.setCompletedKeys(0);
            job.setCompletedYears(0);
            serializeProgress(job, progress);
            job = jobRepository.save(job);

            int completedYears = 0;
            int completedKeys = 0;

            for (String luKey : luKeys) {
                Map<Integer, String> yearMap = s3Inventory.getOrDefault(luKey, new LinkedHashMap<>());
                if (yearMap.isEmpty()) {
                    completedKeys++;
                    job.setCompletedKeys(completedKeys);
                    job = jobRepository.save(job);
                    continue;
                }

                for (Map.Entry<Integer, String> ye : yearMap.entrySet()) {
                    int year = ye.getKey();
                    String s3Key = ye.getValue();

                    if (incremental && statsRepository.existsByLanduseKeyAndYear(luKey, year)) {
                        log.info("[lu:compute] Skipping (already computed): {} / {}", luKey, year);
                        progress.get(luKey).put(String.valueOf(year), "skipped");
                        serializeProgress(job, progress);
                        completedYears++;
                        job.setCompletedYears(completedYears);
                        job = jobRepository.save(job);
                        continue;
                    }

                    log.info("[lu:compute] Computing: {} / {}", luKey, year);
                    try {
                        LanduseYearlyStats stats = computeSingleTiff(luKey, year, s3Key);
                        // Nếu đã có dữ liệu cũ, cập nhật thay vì INSERT (tránh duplicate key)
                        statsRepository.findByLanduseKeyAndYear(luKey, year)
                            .ifPresent(existing -> stats.setId(existing.getId()));
                        statsRepository.save(stats);
                        progress.get(luKey).put(String.valueOf(year), "done");
                        log.info("[lu:compute] Done: {} / {} → {} ha ({} pixels)", luKey, year, stats.getAreaHa(), stats.getClassPixels());
                    } catch (Exception e) {
                        log.error("[lu:compute] Failed: {} / {}: {}", luKey, year, e.getMessage());
                        progress.get(luKey).put(String.valueOf(year), "failed: " + e.getMessage());
                    }

                    serializeProgress(job, progress);
                    completedYears++;
                    job.setCompletedYears(completedYears);
                    job = jobRepository.save(job);
                }

                completedKeys++;
                job.setCompletedKeys(completedKeys);
                job = jobRepository.save(job);
            }

            job.setStatus(LanduseComputationJob.Status.COMPLETED);
            job.setCompletedAt(Instant.now());
            serializeProgress(job, progress);
            jobRepository.save(job);

        } catch (Exception e) {
            log.error("[lu:compute] Job {} failed", jobId, e);
            job.setStatus(LanduseComputationJob.Status.FAILED);
            job.setErrorMessage(e.getMessage());
            job.setCompletedAt(Instant.now());
            jobRepository.save(job);
        }
    }

    /**
     * Download a TIFF from S3, decode it, count non-zero pixels, compute area.
     */
    LanduseYearlyStats computeSingleTiff(String landuseKey, int year, String s3Key) throws Exception {
        byte[] tiffBytes;
        try (InputStream is = s3Service.downloadFile(s3Key)) {
            tiffBytes = is.readAllBytes();
        }

        ImageReader reader = ImageIO.getImageReadersByFormatName("tiff").next();
        if (reader == null) {
            throw new RuntimeException("No TIFF ImageReader found. Is TwelveMonkeys on classpath?");
        }

        float[] pixels;
        int width;
        int height;
        try (ImageInputStream iis = ImageIO.createImageInputStream(new ByteArrayInputStream(tiffBytes))) {
            reader.setInput(iis);
            Raster raster = reader.readRaster(0, null);
            width = raster.getWidth();
            height = raster.getHeight();

            int totalPixels = width * height;
            pixels = new float[totalPixels];
            int bandCount = raster.getNumBands();
            float[] sampleBuf = new float[bandCount];

            for (int y = 0; y < height; y++) {
                for (int x = 0; x < width; x++) {
                    raster.getPixel(x, y, sampleBuf);
                    pixels[y * width + x] = sampleBuf[0];
                }
            }
        } finally {
            reader.dispose();
        }

        double pixelAreaM2 = (UTM48N_WIDTH_M / width) * (UTM48N_HEIGHT_M / height);
        int totalPixels = pixels.length;
        int classPixels = 0;

        for (float v : pixels) {
            if (Float.isNaN(v)) continue;
            if (v == 0.0f) continue;
            if (v == -9999.0f) continue;
            classPixels++;
        }

        double areaHa = (classPixels * pixelAreaM2) / 10000.0;
        // Percentage = area of this class relative to actual Tra Vinh province area (211,074 ha)
        double percentage = (areaHa * 100.0) / 211074.0;

        LanduseYearlyStats stats = new LanduseYearlyStats();
        stats.setLanduseKey(landuseKey);
        stats.setYear(year);
        stats.setAreaHa(areaHa);
        stats.setClassPixels((long) classPixels);
        stats.setTotalPixels((long) totalPixels);
        stats.setPercentage(percentage);
        stats.setImageWidth(width);
        stats.setImageHeight(height);
        stats.setPixelAreaM2(pixelAreaM2);
        stats.setS3Key(s3Key);
        stats.setComputedAt(Instant.now());

        return stats;
    }

    public ComputeStatusResponse getStatus() {
        LanduseComputationJob job = jobRepository.findTopByOrderByCreatedAtDesc().orElse(null);
        if (job == null) {
            return ComputeStatusResponse.builder().status("NEVER_RUN").build();
        }
        return toStatusResponse(job);
    }

    ComputeStatusResponse toStatusResponse(LanduseComputationJob job) {
        Map<String, Map<String, String>> progress = deserializeProgress(job.getProgressDetail());
        return ComputeStatusResponse.builder()
                .jobId(job.getId())
                .status(job.getStatus().name())
                .triggeredBy(job.getTriggeredBy())
                .totalKeys(job.getTotalKeys())
                .completedKeys(job.getCompletedKeys())
                .totalYears(job.getTotalYears())
                .completedYears(job.getCompletedYears())
                .errorMessage(job.getErrorMessage())
                .progressDetail(progress)
                .startedAt(job.getStartedAt())
                .completedAt(job.getCompletedAt())
                .createdAt(job.getCreatedAt())
                .updatedAt(job.getUpdatedAt())
                .build();
    }

    private void serializeProgress(LanduseComputationJob job, Map<String, Map<String, String>> progress) {
        try {
            job.setProgressDetail(objectMapper.writeValueAsString(progress));
        } catch (JsonProcessingException e) {
            log.warn("[lu:compute] Failed to serialize progress", e);
        }
    }

    private Map<String, Map<String, String>> deserializeProgress(String json) {
        if (json == null || json.isBlank()) return new LinkedHashMap<>();
        try {
            return objectMapper.readValue(json, new TypeReference<Map<String, Map<String, String>>>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    /**
     * Scan S3 for all TIFF files under the landuse prefix.
     * Returns: Map<landuseKey, Map<year, s3Key>>
     */
    Map<String, Map<Integer, String>> scanS3ForLanduse() {
        Map<String, Map<Integer, String>> result = new LinkedHashMap<>();

        try {
            var files = s3Service.listFiles(S3_LANDUSE_PREFIX);

            for (var f : files) {
                String key = f.getKey();
                if (!key.toLowerCase().endsWith(".tif") && !key.toLowerCase().endsWith(".tiff")) {
                    continue;
                }

                Matcher luMatcher = LU_KEY_PATTERN.matcher(key);
                if (!luMatcher.find()) continue;
                String luSub = luMatcher.group(1);
                String luKey = "landuse-classification/" + luSub;

                if (!LANDUSE_NAME_MAP.containsKey(luKey)) continue;

                Matcher yearMatcher = YEAR_PATTERN.matcher(key);
                if (!yearMatcher.find()) continue;
                int year = Integer.parseInt(yearMatcher.group(1));
                if (year < 1990 || year > 2030) continue;

                result.computeIfAbsent(luKey, k -> new LinkedHashMap<>())
                        .putIfAbsent(year, key);
            }
        } catch (Exception e) {
            log.error("[lu:compute] Failed to scan S3", e);
        }

        return result;
    }
}
