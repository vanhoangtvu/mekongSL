package com.mekongsaltlab.org.controller.gis;

import com.mekongsaltlab.org.entity.gis.ManualStation;
import com.mekongsaltlab.org.repository.gis.ManualStationRepository;
import com.mekongsaltlab.org.service.S3Service;
import lombok.RequiredArgsConstructor;
import org.apache.poi.ss.usermodel.*;
import org.apache.poi.xssf.usermodel.*;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.time.Instant;
import java.util.*;

@RestController
@RequestMapping("/api/gis/manual-stations")
@RequiredArgsConstructor
public class ManualStationController {

    private final ManualStationRepository manualStationRepository;
    private final S3Service s3Service;

    @GetMapping
    public ResponseEntity<List<ManualStation>> list() {
        return ResponseEntity.ok(manualStationRepository.findByIsActiveTrue());
    }

    @GetMapping("/type/{type}")
    public ResponseEntity<List<ManualStation>> listByType(@PathVariable String type) {
        return ResponseEntity.ok(manualStationRepository.findByStationTypeAndIsActiveTrue(type));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ManualStation> getById(@PathVariable Long id) {
        return manualStationRepository.findById(id)
            .filter(ManualStation::getIsActive)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<ManualStation> create(@RequestBody ManualStation station) {
        if (station.getStationId() == null || station.getStationId().trim().isEmpty()) {
            station.setStationId(generateUniqueStationId(station.getStationType()));
        } else {
            station.setStationId(station.getStationId().trim());
        }
        station.setIsActive(true);
        station.setCreatedAt(Instant.now());
        return ResponseEntity.ok(manualStationRepository.save(station));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ManualStation> update(@PathVariable Long id, @RequestBody ManualStation request) {
        return manualStationRepository.findById(id)
            .map(station -> {
                if (request.getStationId() != null) {
                    station.setStationId(request.getStationId().trim().isEmpty() ? 
                        generateUniqueStationId(station.getStationType()) : request.getStationId().trim());
                }
                if (request.getStationType() != null) station.setStationType(request.getStationType());
                if (request.getLocation() != null) station.setLocation(request.getLocation());
                if (request.getHydroChar() != null) station.setHydroChar(request.getHydroChar());
                if (request.getX() != null) station.setX(request.getX());
                if (request.getY() != null) station.setY(request.getY());
                if (request.getIsActive() != null) station.setIsActive(request.getIsActive());
                if (request.getImageCode() != null) {
                    String oldImageCode = station.getImageCode();
                    String newImageCode = request.getImageCode();
                    if (oldImageCode != null && !oldImageCode.isEmpty()) {
                        Set<String> newKeys = new HashSet<>();
                        if (newImageCode != null && !newImageCode.isEmpty()) {
                            for (String k : newImageCode.split(",")) {
                                newKeys.add(k.trim());
                            }
                        }
                        for (String k : oldImageCode.split(",")) {
                            String trimmed = k.trim();
                            if (!trimmed.isEmpty() && !newKeys.contains(trimmed)) {
                                try {
                                    s3Service.deleteFile(trimmed);
                                } catch (Exception e) {
                                    System.err.println("Failed to delete removed S3 file during update: " + trimmed + ". Error: " + e.getMessage());
                                }
                            }
                        }
                    }
                    station.setImageCode(newImageCode);
                }
                station.setUpdatedAt(Instant.now());
                return ResponseEntity.ok(manualStationRepository.save(station));
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        return manualStationRepository.findById(id)
            .map(station -> {
                if (station.getImageCode() != null && !station.getImageCode().isEmpty()) {
                    String[] keys = station.getImageCode().split(",");
                    for (String key : keys) {
                        String trimmed = key.trim();
                        if (!trimmed.isEmpty()) {
                            try {
                                s3Service.deleteFile(trimmed);
                            } catch (Exception e) {
                                System.err.println("Failed to delete S3 file on station delete: " + trimmed + ". Error: " + e.getMessage());
                            }
                        }
                    }
                }
                manualStationRepository.delete(station);
                return ResponseEntity.noContent().<Void>build();
            })
            .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/import")
    public ResponseEntity<Map<String, Object>> importStations(
        @RequestParam("file") MultipartFile file,
        @RequestParam("stationType") String stationType
    ) {
        try (InputStream is = file.getInputStream();
             XSSFWorkbook workbook = new XSSFWorkbook(is)) {

            XSSFSheet sheet = workbook.getSheetAt(0);
            Row headerRow = sheet.getRow(0);
            if (headerRow == null) {
                return ResponseEntity.badRequest().body(Map.of("error", "Tệp Excel trống hoặc không có dòng tiêu đề!"));
            }

            int colLocation = -1;
            int colHydro = -1;
            int colX = -1;
            int colY = -1;
            int colImage = -1;
            int colStationId = -1;

            for (int c = 0; c < headerRow.getLastCellNum(); c++) {
                Cell cell = headerRow.getCell(c);
                if (cell != null) {
                    String val = cell.getStringCellValue().trim().toUpperCase();
                    if (val.contains("ĐỊA ĐIỂM") || val.contains("LOCATION")) {
                        colLocation = c;
                    } else if (val.contains("MÃ TRẠM") || val.contains("STATION ID") || val.contains("STATION_ID") || val.contains("KÝ HIỆU") || val.equals("MÃ") || val.contains("STATION CODE") || val.equals("ID")) {
                        colStationId = c;
                    } else if (val.contains("ĐẶC TÍNH THỦY VỰC") || val.contains("HYDRO") || val.contains("ĐẶC TÍNH")) {
                        colHydro = c;
                    } else if (val.equals("X") || val.contains("KINH ĐỘ") || val.contains("LONGITUDE")) {
                        colX = c;
                    } else if (val.equals("Y") || val.contains("VĨ ĐỘ") || val.contains("LATITUDE")) {
                        colY = c;
                    } else if (val.contains("HIỆN TRƯỜNG") || val.contains("PICS") || val.contains("MÃ ẢNH") || val.contains("IMAGE")) {
                        colImage = c;
                    }
                }
            }

            if (colLocation == -1) {
                return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy cột thông tin 'ĐỊA ĐIỂM' trong tệp Excel!"));
            }
            if (colX == -1 || colY == -1) {
                return ResponseEntity.badRequest().body(Map.of("error", "Không tìm thấy cột tọa độ 'X' hoặc 'Y' trong tệp Excel!"));
            }

            // Map rows to embedded pictures in the target image column
            Map<Integer, List<PictureData>> rowPictures = new HashMap<>();
            XSSFDrawing drawing = sheet.getDrawingPatriarch();
            if (drawing != null && colImage != -1) {
                for (XSSFShape shape : drawing.getShapes()) {
                    if (shape instanceof XSSFPicture) {
                        XSSFPicture picture = (XSSFPicture) shape;
                        XSSFClientAnchor anchor = picture.getClientAnchor();
                        int row = anchor.getRow1();
                        int col = anchor.getCol1();
                        if (col == colImage) {
                            rowPictures.computeIfAbsent(row, k -> new ArrayList<>()).add(picture.getPictureData());
                        }
                    }
                }
            }

            List<ManualStation> existingStations = manualStationRepository.findByStationTypeAndIsActiveTrue(stationType);
            Set<String> existingLocations = new HashSet<>();
            Set<String> existingCoords = new HashSet<>();
            Set<String> existingStationIds = new HashSet<>();
            for (ManualStation s : existingStations) {
                if (s.getLocation() != null) {
                    existingLocations.add(s.getLocation().trim().toLowerCase());
                }
                if (s.getX() != null && s.getY() != null) {
                    existingCoords.add(s.getX() + "_" + s.getY());
                }
                if (s.getStationId() != null) {
                    existingStationIds.add(s.getStationId().trim().toLowerCase());
                }
            }

            int successCount = 0;
            int duplicateCount = 0;
            int failCount = 0;
            List<String> importErrors = new ArrayList<>();

            for (int r = 1; r <= sheet.getLastRowNum(); r++) {
                Row row = sheet.getRow(r);
                if (row == null) continue;

                Cell locationCell = row.getCell(colLocation);
                if (locationCell == null || locationCell.toString().trim().isEmpty()) {
                    continue; // Skip empty rows
                }

                try {
                    String location = getCellStringValue(locationCell);
                    String hydroChar = colHydro != -1 ? getCellStringValue(row.getCell(colHydro)) : null;
                    Double x = getNumericCellValue(row.getCell(colX));
                    Double y = getNumericCellValue(row.getCell(colY));

                    if (x == null || y == null) {
                        failCount++;
                        importErrors.add("Dòng " + (r + 1) + ": Sai định dạng hoặc thiếu tọa độ X/Y.");
                        continue;
                    }

                    String excelStationId = colStationId != -1 ? getCellStringValue(row.getCell(colStationId)) : null;
                    String finalStationId;
                    if (excelStationId == null || excelStationId.trim().isEmpty()) {
                        finalStationId = generateUniqueStationId(stationType, existingStationIds);
                    } else {
                        finalStationId = excelStationId.trim();
                    }

                    String locationKey = location.trim().toLowerCase();
                    String coordKey = x + "_" + y;
                    String stationIdKey = finalStationId.toLowerCase();

                    boolean isDuplicate = false;
                    if (excelStationId != null && !excelStationId.trim().isEmpty()) {
                        if (existingStationIds.contains(stationIdKey)) {
                            isDuplicate = true;
                        }
                    } else {
                        if (existingLocations.contains(locationKey) && existingCoords.contains(coordKey)) {
                            isDuplicate = true;
                        }
                    }

                    if (isDuplicate) {
                        duplicateCount++;
                        continue;
                    }

                    List<String> s3Keys = new ArrayList<>();
                    if ("surface_water".equals(stationType) && colImage != -1) {
                        List<PictureData> pics = rowPictures.get(r);
                        if (pics != null) {
                            for (int i = 0; i < pics.size(); i++) {
                                PictureData pic = pics.get(i);
                                byte[] bytes = pic.getData();
                                String ext = pic.suggestFileExtension();
                                String s3Key = "station-data/manual-stations/station_import_" + System.currentTimeMillis() + "_" + UUID.randomUUID().toString().substring(0, 8) + "_" + i + "." + ext;
                                
                                s3Service.uploadFile(s3Key, new java.io.ByteArrayInputStream(bytes), bytes.length);
                                s3Keys.add(s3Key);
                            }
                        }
                    }

                    String imageCode = s3Keys.isEmpty() ? null : String.join(",", s3Keys);

                    ManualStation station = new ManualStation();
                    station.setStationId(finalStationId);
                    station.setStationType(stationType);
                    station.setLocation(location);
                    station.setHydroChar(hydroChar);
                    station.setX(x);
                    station.setY(y);
                    station.setImageCode(imageCode);
                    station.setIsActive(true);
                    station.setCreatedAt(Instant.now());

                    manualStationRepository.save(station);
                    
                    existingLocations.add(locationKey);
                    existingCoords.add(coordKey);
                    existingStationIds.add(stationIdKey);
                    
                    successCount++;
                } catch (Exception e) {
                    failCount++;
                    importErrors.add("Dòng " + (r + 1) + ": " + e.getMessage());
                }
            }

            Map<String, Object> result = new HashMap<>();
            result.put("successCount", successCount);
            result.put("duplicateCount", duplicateCount);
            result.put("failCount", failCount);
            result.put("errors", importErrors);
            result.put("message", "Nhập danh sách trạm thành công! Thành công: " + successCount + " trạm, Trùng lặp (bỏ qua): " + duplicateCount + " trạm, Thất bại: " + failCount + " trạm.");

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(Map.of("error", "Lỗi xử lý tệp Excel: " + e.getMessage()));
        }
    }

    private String getCellStringValue(Cell cell) {
        if (cell == null) return "";
        switch (cell.getCellType()) {
            case STRING:
                return cell.getStringCellValue().trim();
            case NUMERIC:
                double val = cell.getNumericCellValue();
                if (val == (long) val) {
                    return String.valueOf((long) val);
                }
                return String.valueOf(val);
            case BOOLEAN:
                return String.valueOf(cell.getBooleanCellValue());
            default:
                return cell.toString().trim();
        }
    }

    private Double getNumericCellValue(Cell cell) {
        if (cell == null) return null;
        switch (cell.getCellType()) {
            case NUMERIC:
                return cell.getNumericCellValue();
            case STRING:
                try {
                    return Double.parseDouble(cell.getStringCellValue().trim());
                } catch (NumberFormatException e) {
                    return null;
                }
            default:
                return null;
        }
    }

    private String generateUniqueStationId(String stationType) {
        return generateUniqueStationId(stationType, new HashSet<>());
    }

    private String generateUniqueStationId(String stationType, Set<String> existingStationIds) {
        String prefix = "groundwater".equals(stationType) ? "GW" : "SW";
        List<ManualStation> stations = manualStationRepository.findByStationTypeAndIsActiveTrue(stationType);
        int maxNum = 0;
        for (ManualStation s : stations) {
            if (s.getStationId() != null && s.getStationId().startsWith(prefix)) {
                try {
                    String numPart = s.getStationId().substring(prefix.length());
                    int num = Integer.parseInt(numPart.trim());
                    if (num > maxNum) {
                        maxNum = num;
                    }
                } catch (NumberFormatException e) {
                    // Ignore parsing error
                }
            }
        }
        int nextNum = maxNum + 1;
        while (true) {
            String candidate = prefix + String.format("%03d", nextNum);
            if (!existingStationIds.contains(candidate.toLowerCase())) {
                return candidate;
            }
            nextNum++;
        }
    }
}
