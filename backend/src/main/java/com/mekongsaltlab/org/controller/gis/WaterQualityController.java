package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.entity.gis.ManualStation;
import com.mekongsaltlab.org.entity.gis.WaterQualityParameter;
import com.mekongsaltlab.org.entity.gis.WaterQualitySample;
import com.mekongsaltlab.org.repository.gis.ManualStationRepository;
import com.mekongsaltlab.org.repository.gis.WaterQualityParameterRepository;
import com.mekongsaltlab.org.repository.gis.WaterQualitySampleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@RestController
@RequestMapping("/api/gis/water-quality")
@RequiredArgsConstructor
@Slf4j
public class WaterQualityController {

    private final WaterQualitySampleRepository sampleRepo;
    private final WaterQualityParameterRepository paramRepo;
    private final ManualStationRepository stationRepo;

    // ─── DTOs ────────────────────────────────────────────────────────────────

    public record ParameterDto(
        String parameterName,
        String unit,
        String valueRaw,
        Double valueNumeric,
        String referenceStandard,
        Boolean isExceeded,
        int sortOrder
    ) {}

    public record PreviewResult(
        boolean stationFound,
        String recognizedStationId,   // mã trạm nhận diện từ Excel header
        Long stationDbId,              // ID nội bộ trong DB (null nếu không tìm thấy)
        String stationLocation,
        String stationType,
        String zoneDescription,
        String qcvnStandard,
        String rawHeader,
        boolean duplicateExists,       // đã có sample cùng ngày chưa
        List<ParameterDto> parameters,
        String errorMessage            // lỗi nhận diện (null nếu OK)
    ) {}

    public record SampleDto(
        Long id,
        Long stationDbId,
        String stationId,
        String stationLocation,
        String stationType,
        LocalDate sampleDate,
        String zoneDescription,
        String qcvnStandard,
        String notes,
        Instant importedAt,
        String importedBy,
        int parameterCount,
        List<ParameterDto> parameters  // null khi dùng trong danh sách, có khi xem chi tiết
    ) {}

    // ─── Preview endpoint ────────────────────────────────────────────────────

    /**
     * Parse Excel, nhận diện trạm, trả dữ liệu xem trước.
     * Không lưu vào DB.
     *
     * @param file       file Excel chất lượng nước
     * @param sampleDate ngày lấy mẫu (yyyy-MM-dd) — do người dùng nhập
     */
    @PostMapping("/preview")
    public ResponseEntity<PreviewResult> preview(
        @RequestParam("file") MultipartFile file,
        @RequestParam("sampleDate") String sampleDate
    ) {
        try (InputStream is = file.getInputStream();
             Workbook wb = new XSSFWorkbook(is)) {

            Sheet sheet = wb.getSheetAt(0);
            ParsedExcel parsed = parseSheet(sheet);

            // Tìm trạm trong DB
            ManualStation station = findStationByCode(parsed.stationId);
            if (station == null) {
                return ResponseEntity.ok(new PreviewResult(
                    false,
                    parsed.stationId,
                    null, null, null,
                    parsed.zone,
                    parsed.qcvnStandard,
                    parsed.rawHeader,
                    false,
                    parsed.parameters,
                    "Không tìm thấy trạm có mã \"" + parsed.stationId + "\" trong hệ thống. " +
                    "Vui lòng kiểm tra lại mã trạm trong file Excel hoặc tạo trạm trước khi import."
                ));
            }

            // Kiểm tra trùng ngày
            LocalDate date = LocalDate.parse(sampleDate, DateTimeFormatter.ISO_LOCAL_DATE);
            boolean duplicate = sampleRepo.existsByStationIdAndSampleDate(station.getId(), date);

            return ResponseEntity.ok(new PreviewResult(
                true,
                parsed.stationId,
                station.getId(),
                station.getLocation(),
                station.getStationType(),
                parsed.zone,
                parsed.qcvnStandard,
                parsed.rawHeader,
                duplicate,
                parsed.parameters,
                null
            ));

        } catch (Exception e) {
            return ResponseEntity.badRequest().body(new PreviewResult(
                false, null, null, null, null, null, null, null, false, null,
                "Lỗi đọc file Excel: " + e.getMessage()
            ));
        }
    }

    // ─── Import endpoint ─────────────────────────────────────────────────────

    /**
     * Xác nhận import và lưu vào DB.
     *
     * @param overwrite nếu TRUE và đã có sample cùng ngày → xóa cái cũ và lưu mới
     *                  nếu FALSE và đã có sample cùng ngày → thêm mới (thêm 1 lần đo nữa)
     */
    @PostMapping("/import")
    @Transactional
    public ResponseEntity<SampleDto> importSample(
        @RequestParam("file") MultipartFile file,
        @RequestParam("sampleDate") String sampleDate,
        @RequestParam(value = "notes", required = false) String notes,
        @RequestParam(value = "overwrite", defaultValue = "false") boolean overwrite,
        @RequestParam(value = "importedBy", required = false, defaultValue = "system") String importedBy,
        @RequestParam(value = "stationDbId", required = false) Long stationDbId
    ) {
        try (InputStream is = file.getInputStream();
             Workbook wb = new XSSFWorkbook(is)) {

            Sheet sheet = wb.getSheetAt(0);
            ParsedExcel parsed = parseSheet(sheet);

            ManualStation station;
            if (stationDbId != null) {
                station = stationRepo.findById(stationDbId).orElse(null);
                log.info("Import WQ: using stationDbId={} → station={} (id={})",
                    stationDbId, station != null ? station.getStationId() : "NOT FOUND", station != null ? station.getId() : null);
                if (station == null) {
                    return ResponseEntity.badRequest().build();
                }
            } else {
                station = findStationByCode(parsed.stationId);
                log.info("Import WQ: found by code '{}' → station={} (id={})",
                    parsed.stationId, station != null ? station.getStationId() : "NOT FOUND", station != null ? station.getId() : null);
            }
            if (station == null) {
                return ResponseEntity.badRequest().build();
            }

            LocalDate date = LocalDate.parse(sampleDate, DateTimeFormatter.ISO_LOCAL_DATE);

            // Xử lý trùng lặp
            if (overwrite) {
                List<WaterQualitySample> existingSamples = sampleRepo.findByStationIdAndSampleDate(station.getId(), date);
                if (!existingSamples.isEmpty()) {
                    sampleRepo.deleteAll(existingSamples);
                }
            }

            // Tạo sample
            WaterQualitySample sample = new WaterQualitySample();
            sample.setStation(station);
            sample.setSampleDate(date);
            sample.setStationType(station.getStationType());
            sample.setZoneDescription(parsed.zone);
            sample.setQcvnStandard(parsed.qcvnStandard);
            sample.setRawHeader(parsed.rawHeader);
            sample.setNotes(notes);
            sample.setImportedAt(Instant.now());
            sample.setImportedBy(importedBy);
            sample = sampleRepo.save(sample);
            log.info("Imported sample id={} for station db_id={} (code={}), date={}",
                sample.getId(), sample.getStation().getId(), sample.getStation().getStationId(), date);

            // Tạo thông số
            List<WaterQualityParameter> params = new ArrayList<>();
            for (ParameterDto dto : parsed.parameters) {
                WaterQualityParameter p = new WaterQualityParameter();
                p.setSample(sample);
                p.setParameterName(dto.parameterName());
                p.setUnit(dto.unit());
                p.setValueRaw(dto.valueRaw());
                p.setValueNumeric(dto.valueNumeric());
                p.setReferenceStandard(dto.referenceStandard());
                p.setIsExceeded(dto.isExceeded());
                p.setSortOrder(dto.sortOrder());
                params.add(p);
            }
            paramRepo.saveAll(params);

            SampleDto result = toSampleDto(sample, params);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/recent")
    public ResponseEntity<List<SampleDto>> listRecent() {
        log.info("=== listRecent samples ===");
        List<WaterQualitySample> samples = sampleRepo.findAllOrderByImportedAtDesc();
        List<SampleDto> result = samples.stream()
            .map(s -> toSampleDto(s, null))
            .toList();
        return ResponseEntity.ok(result);
    }

    // ─── List samples of a station ───────────────────────────────────────────

    @GetMapping("/station/{stationDbId}")
    public ResponseEntity<List<SampleDto>> listByStation(@PathVariable Long stationDbId) {
        log.info("=== listByStation: station DB id={} ===", stationDbId);
        // Check latest sample in DB to verify FK is set
        Long latestStationDbId = sampleRepo.findLatestStationDbId();
        log.info("Latest sample has station_db_id={}", latestStationDbId);
        // Query with native SQL to bypass any JPQL mapping issues
        List<WaterQualitySample> samples = sampleRepo.findByStationDbIdNative(stationDbId);
        log.info("Native query found {} samples for station_db_id={}", samples.size(), stationDbId);
        // Also check with JPQL for comparison
        List<WaterQualitySample> jpqlSamples = sampleRepo.findByStationIdOrderBySampleDateDesc(stationDbId);
        log.info("JPQL query found {} samples for station.id={}", jpqlSamples.size(), stationDbId);
        List<SampleDto> result = samples.stream()
            .map(s -> toSampleDto(s, null))
            .toList();
        return ResponseEntity.ok(result);
    }

    // ─── Get sample detail ───────────────────────────────────────────────────

    @GetMapping("/sample/{sampleId}")
    public ResponseEntity<SampleDto> getSample(@PathVariable Long sampleId) {
        return sampleRepo.findById(sampleId)
            .map(sample -> {
                List<WaterQualityParameter> params = paramRepo.findBySampleIdOrderBySortOrder(sampleId);
                return ResponseEntity.ok(toSampleDto(sample, params));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    // ─── Delete sample ───────────────────────────────────────────────────────

    @DeleteMapping("/sample/{sampleId}")
    @Transactional
    public ResponseEntity<Void> deleteSample(@PathVariable Long sampleId) {
        if (!sampleRepo.existsById(sampleId)) {
            return ResponseEntity.notFound().build();
        }
        paramRepo.deleteBySampleId(sampleId);
        sampleRepo.deleteById(sampleId);
        return ResponseEntity.ok().build();
    }

    // ─── Excel Parsing ───────────────────────────────────────────────────────

    private record ParsedExcel(
        String stationId,
        String zone,
        String qcvnStandard,
        String rawHeader,
        List<ParameterDto> parameters
    ) {}

    /**
     * Parse sheet Excel theo định dạng:
     * Row 0: "SL7: GROUND WATERQUALITY. UTM 48N_656330_1096545__ZONE: CLEAN BRACKISH WATER"
     * Row 1: PARAMETRS | UNIT | VALUE | REF(QCVN09:2023/BTNMT)
     * Row 2+: data rows
     */
    private ParsedExcel parseSheet(Sheet sheet) {
        // Dòng 0: tiêu đề - Tìm ô đầu tiên có chữ
        Row headerRow = sheet.getRow(0);
        String rawHeader = "";
        if (headerRow != null) {
            for (int c = 0; c < headerRow.getLastCellNum(); c++) {
                String val = getCellStringFull(headerRow, c);
                if (!val.isBlank()) {
                    rawHeader = val;
                    break;
                }
            }
        }

        // Nhận diện mã trạm: lấy phần trước dấu : hoặc space đầu tiên
        String stationId = extractStationId(rawHeader);

        // Nhận diện vùng (ZONE)
        String zone = extractZone(rawHeader);

        // Nhận diện tiêu chuẩn QCVN từ dòng tiêu đề cột (Row 1 hoặc Row 2)
        String qcvnStandard = extractQcvn(sheet);

        // Tìm dòng tiêu đề cột (có chữ PARAMETRS hoặc PARAMETERS) và các chỉ số cột tương ứng
        int headerRowIndex = findHeaderRowIndex(sheet);
        int colParam = 0;
        int colUnit = 1;
        int colValue = 2;
        int colRef = 3;

        if (headerRowIndex != -1) {
            Row hr = sheet.getRow(headerRowIndex);
            for (int c = 0; c < hr.getLastCellNum(); c++) {
                String val = getCellStringFull(hr, c).toUpperCase().trim();
                if (val.contains("PARAMETR")) {
                    colParam = c;
                } else if (val.contains("UNIT")) {
                    colUnit = c;
                } else if (val.contains("VALUE")) {
                    colValue = c;
                } else if (val.contains("REF")) {
                    colRef = c;
                }
            }
        }

        int dataStartRow = headerRowIndex != -1 ? headerRowIndex + 1 : 2;

        // Parse thông số
        List<ParameterDto> parameters = parseParameters(sheet, dataStartRow, colParam, colUnit, colValue, colRef);

        return new ParsedExcel(stationId, zone, qcvnStandard, rawHeader, parameters);
    }

    /** Trích xuất mã trạm từ chuỗi tiêu đề */
    private String extractStationId(String header) {
        if (header == null || header.isBlank()) return "";
        // Pattern: SL7: hoặc SL9 (space/chữ theo sau)
        Pattern p = Pattern.compile("(?i)^([A-Z]{1,4}\\d{1,4})[:\\s]");
        Matcher m = p.matcher(header.trim());
        if (m.find()) return m.group(1).toUpperCase();
        // Fallback: lấy token đầu tiên
        String first = header.trim().split("[:\\s]")[0];
        return first.toUpperCase();
    }

    /** Trích xuất ZONE từ tiêu đề */
    private String extractZone(String header) {
        if (header == null) return null;
        // Tìm sau từ ZONE:
        Pattern p = Pattern.compile("(?i)ZONE[:\\s_]+(.+)$");
        Matcher m = p.matcher(header.trim());
        if (m.find()) return m.group(1).trim();
        return null;
    }

    /** Tìm chuỗi QCVN từ dòng tiêu đề cột (Row 1 hoặc 2) */
    private String extractQcvn(Sheet sheet) {
        for (int r = 1; r <= 3; r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            for (int c = 0; c < row.getLastCellNum(); c++) {
                String val = getCellStringFull(row, c);
                if (val.toUpperCase().contains("QCVN")) {
                    // Trích pattern: QCVN09:2023/BTNMT hoặc QCVN 08:2023/BTNMT
                    Pattern p = Pattern.compile("(?i)(QCVN[\\s\\d.:]+/BTNMT)");
                    Matcher m = p.matcher(val);
                    if (m.find()) return m.group(1).trim();
                    return val.trim();
                }
            }
        }
        return null;
    }

    /** Tìm row index của dòng tiêu đề (chứa PARAMETR) */
    private int findHeaderRowIndex(Sheet sheet) {
        for (int r = 0; r <= 5; r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;
            for (int c = 0; c < row.getLastCellNum(); c++) {
                String val = getCellStringFull(row, c).toUpperCase();
                if (val.contains("PARAMETR")) {
                    return r;
                }
            }
        }
        return -1;
    }

    /** Parse tất cả dòng thông số bắt đầu từ dataStartRow */
    private List<ParameterDto> parseParameters(Sheet sheet, int dataStartRow, int colParam, int colUnit, int colValue, int colRef) {
        List<ParameterDto> result = new ArrayList<>();
        int sortOrder = 0;

        for (int r = dataStartRow; r <= sheet.getLastRowNum(); r++) {
            Row row = sheet.getRow(r);
            if (row == null) continue;

            String paramName = getCellStringFull(row, colParam);
            if (paramName.isBlank()) continue; // dòng trống

            String unit = getCellStringFull(row, colUnit);
            String valueRaw = getCellStringFull(row, colValue);
            if (valueRaw.isBlank()) continue; // dòng không có giá trị → bỏ qua
            String refStd = getCellStringFull(row, colRef);

            // Parse giá trị số
            Double valueNumeric = parseNumeric(valueRaw);

            result.add(new ParameterDto(
                paramName.trim(), unit.trim(), valueRaw.trim(),
                valueNumeric, refStd.trim().isEmpty() ? null : refStd.trim(),
                null, sortOrder++
            ));
        }
        return result;
    }

    /**
     * Parse số từ chuỗi giá trị.
     * Trả NULL nếu không parse được (e.g., "không phát hiện", "Not detected").
     */
    private Double parseNumeric(String raw) {
        if (raw == null || raw.isBlank()) return null;
        // Nếu chứa chữ không phải số → không parse
        String lower = raw.toLowerCase();
        if (lower.contains("không") || lower.contains("not") || lower.contains("nd") ||
            lower.contains("phát hiện") || lower.contains("detected") || lower.contains("lod")) {
            return null;
        }
        // Làm sạch: bỏ dấu phẩy kiểu Việt dùng như phân cách hàng nghìn
        String cleaned = raw.trim()
            .replace(",", ".")
            .replaceAll("[^\\d.\\-]", "");
        try {
            return Double.parseDouble(cleaned);
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Tìm ManualStation theo stationId (case-insensitive) */
    private ManualStation findStationByCode(String stationId) {
        if (stationId == null || stationId.isBlank()) return null;
        List<ManualStation> all = stationRepo.findAll();
        log.info("findStationByCode: searching for '{}' among {} stations", stationId, all.size());
        for (var s : all) {
            log.debug("  station: id={}, stationId='{}'", s.getId(), s.getStationId());
        }
        return all.stream()
            .filter(s -> stationId.equalsIgnoreCase(s.getStationId()))
            .findFirst()
            .orElse(null);
    }

    /** Đọc giá trị cell thành String, hỗ trợ cả NUMERIC và STRING */
    private String getCellStringFull(Row row, int colIndex) {
        if (row == null) return "";
        Cell cell = row.getCell(colIndex, Row.MissingCellPolicy.RETURN_BLANK_AS_NULL);
        if (cell == null) return "";
        return switch (cell.getCellType()) {
            case STRING -> cell.getStringCellValue().trim();
            case NUMERIC -> {
                double d = cell.getNumericCellValue();
                if (d == Math.floor(d) && !Double.isInfinite(d)) {
                    yield String.valueOf((long) d);
                }
                yield String.valueOf(d);
            }
            case BOOLEAN -> String.valueOf(cell.getBooleanCellValue());
            case FORMULA -> {
                try { yield String.valueOf(cell.getNumericCellValue()); }
                catch (Exception e) { yield cell.getStringCellValue(); }
            }
            default -> "";
        };
    }

    /** Convert WaterQualitySample + params → DTO */
    private SampleDto toSampleDto(WaterQualitySample sample, List<WaterQualityParameter> params) {
        ManualStation st = sample.getStation();
        List<ParameterDto> paramDtos = params == null ? null : params.stream()
            .map(p -> new ParameterDto(
                p.getParameterName(), p.getUnit(), p.getValueRaw(),
                p.getValueNumeric(), p.getReferenceStandard(), p.getIsExceeded(), p.getSortOrder()
            )).toList();

        int paramCount = params != null ? params.size()
            : (int) paramRepo.findBySampleIdOrderBySortOrder(sample.getId()).size();

        return new SampleDto(
            sample.getId(),
            st != null ? st.getId() : null,
            st != null ? st.getStationId() : null,
            st != null ? st.getLocation() : null,
            sample.getStationType(),
            sample.getSampleDate(),
            sample.getZoneDescription(),
            sample.getQcvnStandard(),
            sample.getNotes(),
            sample.getImportedAt(),
            sample.getImportedBy(),
            paramCount,
            paramDtos
        );
    }
}
