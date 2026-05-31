package com.mekongsaltlab.org.service.gis;

import com.mekongsaltlab.org.entity.gis.Dataset;
import com.mekongsaltlab.org.entity.gis.Layer;
import com.mekongsaltlab.org.entity.gis.enums.GisDataType;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

@Service
public class StoragePathService {

    private static final String GIS_PREFIX = "gis-data";
    private static final String STATION_PREFIX = "station-data";
    private static final String MONITORING_PREFIX = "monitoring-data";

    public String buildGisPath(Layer layer, String filename,
                               Integer month, Integer day, String time) {
        Dataset dataset = layer.getDataset();
        String datasetSlug = dataset.getSlug();
        String category = layer.getCategory();
        Integer year = layer.getYear();
        GisDataType dataType = layer.getGisDataType();

        if (category == null) category = "default";
        if (year == null) year = ZonedDateTime.now(ZoneId.of("UTC")).getYear();
        if (dataType == null) dataType = GisDataType.RASTER;

        return buildGisPath(
            datasetSlug, category, year, month, day, time,
            dataType.name().toLowerCase(), filename);
    }

    public String buildGisPath(Layer layer, String filename) {
        return buildGisPath(layer, filename, null, null, null);
    }

    public String buildGisPath(String datasetSlug, String category,
                               int year, Integer month, Integer day, String time,
                               String dataType, String filename) {
        String sanitizedDataset = sanitize(datasetSlug);
        String sanitizedCategory = sanitize(category);
        String sanitizedFilename = sanitizeFilename(filename);
        String sanitizedDataType = sanitizeDataType(dataType);

        StringBuilder sb = new StringBuilder();
        sb.append(GIS_PREFIX).append("/")
            .append(sanitizedDataset).append("/")
            .append(sanitizedCategory).append("/")
            .append(year);

        if (month != null) {
            sb.append("/").append(String.format("%02d", month));
            if (day != null) {
                sb.append("/").append(String.format("%02d", day));
                if (time != null && !time.isEmpty()) {
                    sb.append("/").append(formatTime(time));
                }
            }
        }

        sb.append("/").append(sanitizedDataType);
        sb.append("/").append(sanitizedFilename);

        return sb.toString();
    }

    public String buildStationPath(String stationDataType, String stationCode,
                                   String parameter, int year, int month, int day,
                                   String time, String filename) {
        String sanitizedDataType = sanitize(stationDataType);
        String sanitizedCode = sanitize(stationCode);
        String sanitizedParam = sanitizeParameter(parameter);
        String sanitizedFilename = sanitizeFilename(filename);
        String sanitizedTime = formatTime(time);

        return String.format("%s/%s/%s/%s/%d/%02d/%02d/%s/%s",
            STATION_PREFIX, sanitizedDataType, sanitizedCode, sanitizedParam,
            year, month, day, sanitizedTime, sanitizedFilename);
    }

    public String buildStationPath(String stationCode, String parameter,
                                   int year, int month, int day, String filename) {
        return buildStationPath("default", stationCode, parameter,
            year, month, day, "00-00", filename);
    }

    public String buildMonitoringPath(String monitoringCode, String parameter,
                                      int year, int month, int day,
                                      String time, String filename) {
        String sanitizedCode = sanitize(monitoringCode);
        String sanitizedParam = sanitizeParameter(parameter);
        String sanitizedFilename = sanitizeFilename(filename);
        String sanitizedTime = formatTime(time);

        return String.format("%s/%s/%s/%d/%02d/%02d/%s/%s",
            MONITORING_PREFIX, sanitizedCode, sanitizedParam,
            year, month, day, sanitizedTime, sanitizedFilename);
    }

    public String buildMonitoringPath(String monitoringCode, String parameter,
                                      int year, int month, int day, String filename) {
        return buildMonitoringPath(monitoringCode, parameter,
            year, month, day, "00-00", filename);
    }

    public String buildStationFolderPath(String stationDataType, String stationCode,
                                         String parameter, int year, int month, int day) {
        String sanitizedDataType = sanitize(stationDataType);
        String sanitizedCode = sanitize(stationCode);
        String sanitizedParam = sanitizeParameter(parameter);

        return String.format("%s/%s/%s/%s/%d/%02d/%02d/",
            STATION_PREFIX, sanitizedDataType, sanitizedCode, sanitizedParam,
            year, month, day);
    }

    public String buildMonitoringFolderPath(String monitoringCode, String parameter,
                                            int year, int month, int day) {
        String sanitizedCode = sanitize(monitoringCode);
        String sanitizedParam = sanitizeParameter(parameter);

        return String.format("%s/%s/%s/%d/%02d/%02d/",
            MONITORING_PREFIX, sanitizedCode, sanitizedParam, year, month, day);
    }

    public String buildGisFolderPath(Layer layer, Integer month, Integer day, String time) {
        Dataset dataset = layer.getDataset();
        String datasetSlug = dataset.getSlug();
        String category = layer.getCategory();
        Integer year = layer.getYear();
        GisDataType dataType = layer.getGisDataType();

        if (category == null) category = "default";
        if (year == null) year = ZonedDateTime.now(ZoneId.of("UTC")).getYear();
        if (dataType == null) dataType = GisDataType.RASTER;

        String sanitizedDataset = sanitize(datasetSlug);
        String sanitizedCategory = sanitize(category);
        String sanitizedDataType = dataType.name().toLowerCase();

        StringBuilder sb = new StringBuilder();
        sb.append(GIS_PREFIX).append("/")
            .append(sanitizedDataset).append("/")
            .append(sanitizedCategory).append("/")
            .append(year);

        if (month != null) {
            sb.append("/").append(String.format("%02d", month));
            if (day != null) {
                sb.append("/").append(String.format("%02d", day));
                if (time != null && !time.isEmpty()) {
                    sb.append("/").append(formatTime(time));
                }
            }
        }

        sb.append("/").append(sanitizedDataType).append("/");
        return sb.toString();
    }

    private String formatTime(String time) {
        if (time == null || time.isEmpty()) return "00-00";
        return time.replace(":", "-");
    }

    private String sanitize(String segment) {
        if (segment == null) return "default";
        return segment.trim().toLowerCase()
            .replaceAll("[^a-z0-9_\\-]", "-")
            .replaceAll("-+", "-")
            .replaceAll("^-|-$", "");
    }

    private String sanitizeFilename(String filename) {
        if (filename == null) return "unknown";
        return filename.replaceAll("[^a-zA-Z0-9_\\-\\.]", "_");
    }

    private String sanitizeParameter(String parameter) {
        if (parameter == null) return "unknown";
        return parameter.trim().toLowerCase()
            .replaceAll("[^a-z0-9_\\-]", "")
            .replaceAll("-+", "-");
    }

    private String sanitizeDataType(String dataType) {
        if (dataType == null) return "raster";
        return dataType.trim().toLowerCase()
            .replaceAll("[^a-z]", "");
    }
}
