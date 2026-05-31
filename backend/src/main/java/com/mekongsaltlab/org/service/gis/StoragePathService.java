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

    private static final String HYDROLOGY_SLUG = "hydrology";

    public String buildGisPath(Layer layer, String filename) {
        Dataset dataset = layer.getDataset();
        String datasetSlug = dataset.getSlug();
        String category = layer.getCategory();
        Integer year = layer.getYear();
        GisDataType dataType = layer.getGisDataType();

        if (category == null) category = "default";
        if (year == null) year = ZonedDateTime.now(ZoneId.of("UTC")).getYear();
        if (dataType == null) dataType = GisDataType.RASTER;

        String sanitizedCategory = sanitize(category);
        String sanitizedDataset = sanitize(datasetSlug);
        String sanitizedFilename = sanitizeFilename(filename);

        if (HYDROLOGY_SLUG.equals(datasetSlug)) {
            return buildHydrologyPath(sanitizedCategory, year, layer.getObsTimeStart(), sanitizedFilename);
        }

        return String.format("%s/%s/%s/%d/%s/%s",
            GIS_PREFIX, sanitizedDataset, sanitizedCategory, year,
            dataType.name().toLowerCase(), sanitizedFilename);
    }

    public String buildHydrologyPath(String category, int year, Instant obsTime, String filename) {
        ZonedDateTime dt = obsTime != null
            ? obsTime.atZone(ZoneId.of("UTC"))
            : ZonedDateTime.now(ZoneId.of("UTC"));

        int month = dt.getMonthValue();
        int day = dt.getDayOfMonth();
        int hour = dt.getHour();
        int minute = dt.getMinute();
        String time = String.format("%02d%02d", hour, minute);

        String sanitizedCategory = sanitize(category);

        return String.format("%s/hydrology/%s/%d/%02d/%02d/%s/%s",
            GIS_PREFIX, sanitizedCategory, year, month, day, time, filename);
    }

    public String buildStationPath(String stationCode, String parameter, int year, int month, int day, String filename) {
        String sanitizedCode = sanitize(stationCode);
        String sanitizedParam = sanitizeParameter(parameter);
        String sanitizedFilename = sanitizeFilename(filename);

        return String.format("%s/%s/%s/%d/%02d/%02d/%s",
            STATION_PREFIX, sanitizedCode, sanitizedParam, year, month, day, sanitizedFilename);
    }

    public String buildMonitoringPath(String monitoringCode, String parameter, int year, int month, int day, String filename) {
        String sanitizedCode = sanitize(monitoringCode);
        String sanitizedParam = sanitizeParameter(parameter);
        String sanitizedFilename = sanitizeFilename(filename);

        return String.format("%s/%s/%s/%d/%02d/%02d/%s",
            MONITORING_PREFIX, sanitizedCode, sanitizedParam, year, month, day, sanitizedFilename);
    }

    public String buildStationFolderPath(String stationCode, String parameter, int year, int month, int day) {
        String sanitizedCode = sanitize(stationCode);
        String sanitizedParam = sanitizeParameter(parameter);

        return String.format("%s/%s/%s/%d/%02d/%02d/",
            STATION_PREFIX, sanitizedCode, sanitizedParam, year, month, day);
    }

    public String buildMonitoringFolderPath(String monitoringCode, String parameter, int year, int month, int day) {
        String sanitizedCode = sanitize(monitoringCode);
        String sanitizedParam = sanitizeParameter(parameter);

        return String.format("%s/%s/%s/%d/%02d/%02d/",
            MONITORING_PREFIX, sanitizedCode, sanitizedParam, year, month, day);
    }

    public String buildGisFolderPath(Layer layer) {
        Dataset dataset = layer.getDataset();
        String datasetSlug = dataset.getSlug();
        String category = layer.getCategory();
        Integer year = layer.getYear();
        GisDataType dataType = layer.getGisDataType();

        if (category == null) category = "default";
        if (year == null) year = ZonedDateTime.now(ZoneId.of("UTC")).getYear();
        if (dataType == null) dataType = GisDataType.RASTER;

        String sanitizedCategory = sanitize(category);
        String sanitizedDataset = sanitize(datasetSlug);

        if (HYDROLOGY_SLUG.equals(datasetSlug)) {
            return buildHydrologyFolderPath(sanitizedCategory, year, layer.getObsTimeStart());
        }

        return String.format("%s/%s/%s/%d/%s/",
            GIS_PREFIX, sanitizedDataset, sanitizedCategory, year,
            dataType.name().toLowerCase());
    }

    public String buildHydrologyFolderPath(String category, int year, Instant obsTime) {
        ZonedDateTime dt = obsTime != null
            ? obsTime.atZone(ZoneId.of("UTC"))
            : ZonedDateTime.now(ZoneId.of("UTC"));

        int month = dt.getMonthValue();
        int day = dt.getDayOfMonth();
        int hour = dt.getHour();
        int minute = dt.getMinute();
        String time = String.format("%02d%02d", hour, minute);

        return String.format("%s/hydrology/%s/%d/%02d/%02d/%s/",
            GIS_PREFIX, sanitize(category), year, month, day, time);
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
}
