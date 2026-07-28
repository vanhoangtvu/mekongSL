# WEBGIS USER AND ADMINISTRATION MANUAL – MEKONG SALT LAB

**Proposed Title:** WebGIS User and Administration Manual  
**Vietnamese Title:** Sổ tay hướng dẫn sử dụng, cập nhật dữ liệu và quản trị WebGIS Mekong Salt Lab  

> **Version:** 1.0 | **Updated:** 25/07/2026  
> **System:** MekongSaltLab – Geospatial Data Monitoring & Visualization Platform for the Mekong Delta

---

## TABLE OF CONTENTS

- [Introduction](#introduction)
- [Part A. User Guide](#part-a-user-guide)
  - [A.1 Accessing the Portal](#a1-accessing-the-portal)
  - [A.2 Login / Registration](#a2-login--registration)
  - [A.3 Exploring the WebGIS Map](#a3-exploring-the-webgis-map)
  - [A.4 Turning Layers On and Off](#a4-turning-layers-on-and-off)
  - [A.5 Viewing the Legend](#a5-viewing-the-legend)
  - [A.6 Inspecting Map Features (Inspector)](#a6-inspecting-map-features-inspector)
  - [A.7 Viewing Charts](#a7-viewing-charts)
  - [A.8 Filtering Data](#a8-filtering-data)
  - [A.9 Downloading Data](#a9-downloading-data)
  - [A.10 Printing or Exporting the Map](#a10-printing-or-exporting-the-map)
  - [A.11 Viewing Con Chim and Hoa Loi Data](#a11-viewing-con-chim-and-hoa-loi-data)
  - [A.12 Viewing News & Articles](#a12-viewing-news--articles)
- [Part B. Administration Guide](#part-b-administration-guide)
  - [B.1 Admin Login](#b1-admin-login)
  - [B.2 Dashboard Overview](#b2-dashboard-overview)
  - [B.3 Managing S3 Storage](#b3-managing-s3-storage)
  - [B.4 Managing GIS Data](#b4-managing-gis-data)
  - [B.5 Adding a Dataset](#b5-adding-a-dataset)
  - [B.6 Updating Attributes](#b6-updating-attributes)
  - [B.7 Uploading New Monitoring Data](#b7-uploading-new-monitoring-data)
  - [B.8 Managing Monitoring Stations](#b8-managing-monitoring-stations)
  - [B.9 Managing Water Quality Data](#b9-managing-water-quality-data)
  - [B.10 Adding Images](#b10-adding-images)
  - [B.11 Configuring Popups](#b11-configuring-popups)
  - [B.12 Configuring the Legend](#b12-configuring-the-legend)
  - [B.13 User Account Management](#b13-user-account-management)
  - [B.14 Managing Articles](#b14-managing-articles)
  - [B.15 Backup](#b15-backup)
  - [B.16 Restoration](#b16-restoration)
  - [B.17 Data Fetch & Export](#b17-data-fetch--export)
  - [B.18 Landuse Computation](#b18-landuse-computation)
  - [B.19 CORS and IP Configuration](#b19-cors-and-ip-configuration)
- [Appendices](#appendices)
  - [Detailed Permissions Table](#detailed-permissions-table)
  - [Access Information](#access-information)
  - [Glossary](#glossary)

---

## INTRODUCTION

**MekongSaltLab** is a geospatial data monitoring and visualization platform (WebGIS) serving the Mekong Delta region, with a primary focus on **Tra Vinh** province. The system is designed to support water resource management, hydrometeorology, and environmental management through powerful interactive mapping tools.

This manual is divided into two parts:

- **Part A – User Guide:** For all users (USER role) who want to explore and use the system.
- **Part B – Administration Guide:** For data managers (DATA_MANAGER) and system administrators (ADMIN) who need to manage, update data, and configure the system.

---

## Part A. USER GUIDE

### A.1 Accessing the Portal

The MekongSaltLab system can be accessed at the following addresses:

| Information | Value |
|-------------|-------|
| **Frontend URL** | `https://mekongsaltlab.org` |
| **Supported Browsers** | Google Chrome, Firefox, Microsoft Edge (latest versions) |
| **Supported Devices** | Desktop computers, tablets, smartphones |

### A.2 Login / Registration

#### A.2.1 Registering a New Account

| Step | Action |
|:----:|--------|
| 1 | On the homepage, click the **Login** button in the top-right corner of the header. |
| 2 | Switch to the **Sign Up** tab. |
| 3 | Fill in **Username**, **Email**, and **Password** (minimum 6 characters). |
| 4 | Click **Sign Up** to complete. The system automatically logs you in and redirects to the homepage. |

#### A.2.2 Logging In

| Step | Action |
|:----:|--------|
| 1 | Click the **Login** button on the header. |
| 2 | The **Sign In** tab is selected by default. Enter your **Username** and **Password**. |
| 3 | Click **Sign In**. Upon success, the header displays your account name and role. |

#### A.2.3 Logging Out

Click the **Sign Out** button on the right side of the header.

### A.3 Exploring the WebGIS Map

#### A.3.1 Main Interface

| Area | Position | Function |
|------|:--------:|----------|
| **Header Bar** | Top | Logo, slogan, Login/Sign Out button, Admin button (if authorized) |
| **Tab Bar** | Below Header | 3 tabs: Data Sets, Additional Criteria, Results |
| **Left Sidebar** | Left side | Tree view of 8 data categories, layer checkboxes, Apply button |
| **Map Panel** | Center | OpenLayers map with full zoom/pan controls |
| **Map Toolbar** | Below map | Layers, Download, Timeline, Time-Lapse, Change base layer |
| **Footer** | Bottom | Quick links, copyright |

#### A.3.2 List of 8 Data Categories

| Category | Description | Sub-layers | Type |
|----------|-------------|------------|:----:|
| **Landsat Imagery** | 8 Landsat satellite bands | Band 1-7, Composite RGB | Raster |
| **Administration** | Tra Vinh administrative boundaries | Province, Commune, Hamlet | Vector |
| **Baseline Environment** | Baseline environmental data | Landuse Planning (9 districts), Soil Type, Channel System, Ground Water, Road, Landuse Classification | Raster & Vector |
| **Ecology** | Ecological data | Biodiversity, NDVI, Habitat, Species, Mangroves | Vector |
| **Flooding Modeling** | Flood simulation | Flooding Distribution, Flood Depth | Vector |
| **Hydrology Environment** | Real-time hydrological data | Salinity, Tidal, pH (hourly) | Raster |
| **Weather** | Ecowitt weather data | Weather stations as markers | Point |
| **Water Quality** | Water quality data | Surface Water, Ground Water | Point + charts |

### A.4 Turning Layers On and Off

1. **Expand a category:** Click the **+** button to the left of the category name.
2. **Select a layer:** Check the **checkbox** next to the layer you want to display.
3. **Choose display type:** For layers that support both Raster (R) and Vector (V), click the corresponding button.
4. **Apply:** Click the **Apply** button at the bottom of the sidebar.

To turn off a layer, uncheck the checkbox and click **Apply** again.

### A.5 Viewing the Legend

Click the **Layers** button on the map toolbar to open the legend panel. This panel displays:

- List of active layers currently shown on the map
- Colors and symbols corresponding to each layer
- Ability to toggle individual layers on/off directly from the legend

### A.6 Inspecting Map Features (Inspector)

| Action | Result |
|--------|--------|
| **Hover** over a data layer | Popup displays detailed information: attributes, pixel values, coordinates |
| **Click** on a weather station | Popup displays temperature, humidity, wind, rainfall with sparkline charts |
| **Click** on a water quality station | Popup displays water quality parameters and field photos |

### A.7 Viewing Charts

The system provides charts for the following data:

- **Hydrology:** Time-series charts for salinity, pH, and tidal levels
- **Weather:** Sparkline charts for temperature, humidity, wind, and rainfall in station popups
- **Water Quality:** Comparison charts for parameters across monitoring rounds
- **Landuse:** Pie/bar charts showing area statistics by land use type and year

### A.8 Filtering Data

Use the **Additional Criteria** tab next to Data Sets to filter data by:

- **Time:** Select a time range (day, month, year) via the Timeline
- **Parameter:** Filter by data type (Salinity, pH, Tidal, etc.)
- **Area:** Filter by administrative boundary (district, commune)

Filter results are displayed in the **Results** tab.

### A.9 Downloading Data

#### A.9.1 Downloading Public GIS Data

| Step | Action |
|:----:|--------|
| 1 | Click the **Download data** button on the map toolbar. |
| 2 | Select the data layer you want to download. |
| 3 | Choose the format (GeoJSON, Shapefile, GeoTIFF, etc.). |
| 4 | Click **Download**. The file is saved to your computer. |

#### A.9.2 Downloading Excel Data

DATA_MANAGER and ADMIN users can export hydrological data to Excel via the **Data** tab > **Export Excel**.

### A.10 Printing or Exporting the Map

Currently, users can take a screenshot of the map for printing or sharing. A direct print function will be developed in a future version.

### A.11 Viewing Con Chim and Hoa Loi Data

**Con Chim** (Con Chim commune, Cang Long district) and **Hoa Loi** (Hoa Loi commune, Cang Long district) are two case study areas within Tra Vinh province. Related data layers are grouped under the **Con Chim and Hoa Loi** category in the sidebar.

To view the data:

1. In the **Data Sets** sidebar, expand the **Con Chim and Hoa Loi** category.
2. Select the desired data layers:
   - **Land Use** layer – cadastral-scale land use maps for both areas.
   - **Canals** layer – the internal canal network for irrigation.
   - **Monitoring Points** layer – surface water quality measurement points.
   - **Satellite Imagery** layer – Landsat imagery covering the areas.
3. Click **Apply** to display on the map.

> **Tip:** Use **Zoom to Layer** to automatically zoom the map to the exact extent of Con Chim or Hoa Loi.

### A.12 Viewing News & Articles

1. Access the **News** page via the header or footer.
2. Articles are displayed as cards with title, excerpt, and publication date.
3. Click an article to view its full content.
4. You can filter articles by category or search by keyword.

---

## Part B. ADMINISTRATION GUIDE

### B.1 Admin Login

#### B.1.1 Default Accounts

| Role | Username | Password |
|------|----------|----------|
| DATA_MANAGER | `manager` | `manager123` |
| ADMIN | `admin` | `admin123` |

> **Important:** Change your password immediately after the first login!

#### B.1.2 Accessing the Admin Panel

1. Log in with a DATA_MANAGER or ADMIN account.
2. Click the **Admin** button on the header to access the `/data` page.
3. The admin interface includes the following tabs: **Overview**, **Storage**, **Data**, **GIS**, **Articles**, **Users** (ADMIN only).

### B.2 Dashboard Overview

The **Overview** tab displays:

- Logged-in account information (username, email, role, creation date)
- System statistics: total users, number of S3 files, storage usage
- **Trigger Backup** button (ADMIN): manually initiate a system backup

### B.3 Managing S3 Storage

#### B.3.1 S3 Explorer Interface

| Area | Function |
|------|----------|
| **Folder Tree (left)** | Browse the S3 directory structure |
| **File List (right)** | Display files in the selected folder |
| **Toolbar** | Upload, New Folder, Download, Rename, Copy, Delete, Get Signed URL |

#### B.3.2 S3 Directory Structure

| Root Folder | Description | Format |
|:-----------:|-------------|:------:|
| `gis-data/` | GIS data (raster & vector) | .tif, .geojson, .shp, .kml... |
| `station-data/` | Manual station data | .csv |
| `monitoring-data/` | Automatic monitoring station data | .csv |
| `news-images/` | Article images | .jpg, .png, .webp |

#### B.3.3 Uploading a File

1. Browse to the target folder in the folder tree.
2. Click **Upload** > select a file from your computer.
3. Enter an **S3 Key** (optional) to set a different name.
4. Enable **Overwrite** if you want to replace an existing file.
5. Click **Upload**.

#### B.3.4 Creating a New Folder

1. Click **New Folder**.
2. Enter the folder name.
3. Click **Create**.

#### B.3.5 Copying and Moving Files

- **Copy:** Select file > Copy > browse to destination folder > Paste
- **Rename:** Select file > Rename > enter new name > Save
- **Move:** Copy + Paste, then Delete the original file

#### B.3.6 Deleting a File

> **Warning:** Deletion is **permanent** and cannot be undone.

1. Select the file > click **Delete**.
2. Confirm in the dialog box.

### B.4 Managing GIS Data

#### B.4.1 GIS Tab Interface

| Area | Function |
|------|----------|
| **Layer List (left)** | All GIS layers, displaying ID, name, type (RASTER/VECTOR) |
| **Folder Tree (top right)** | Folder structure within the selected layer |
| **Action Area (bottom right)** | New Folder, Upload File, Delete |

#### B.4.2 Managing Folders within a Layer

| Action | Steps |
|--------|-------|
| **View folder tree** | Select a Layer > the folder tree displays automatically |
| **Create new folder** | New Folder > enter name > select parent folder > Save |
| **Delete folder** | Select folder > Delete > confirm (deletes all child files) |

### B.5 Adding a Dataset

A dataset is a data layer within the WebGIS system. To add a new dataset, an ADMIN needs to operate directly via MySQL (there is currently no admin interface for this function). Please contact the system administrator for assistance.

### B.6 Updating Attributes

To update the attributes of a data layer:

1. Go to the **GIS** tab > select the Layer.
2. Select the Folder containing the data file.
3. Upload the new data file (overwrite the old file if needed).
4. The system automatically updates the display on the map.

### B.7 Uploading New Monitoring Data

#### B.7.1 Uploading Manual Station Data (Station Data)

1. Go to the **Storage** tab.
2. Browse to `station-data/{stationCode}/{parameter}/{year}/{month}/{day}/`.
3. Click **Upload** > select the CSV file.

### B.8 Managing Monitoring Stations

#### B.8.1 Viewing the Station List

Go to the **Data** tab > **Manual Stations** to view the station list table with the following information: Station ID, Type (surface_water/groundwater), Location, Coordinates (Lat/Lng), Image Code, Status.

#### B.8.2 Adding a New Station

1. Click **Add Station**.
2. Enter Station ID, select Type, enter Location, Lat/Lng.
3. Enter Image Code (optional).
4. Click **Save**.

#### B.8.3 Importing Stations from Excel

1. Click **Import Excel**.
2. Select an Excel file (columns: Station ID, Type, Location, Lat, Lng, Image Code).
3. Click **Open**. The system automatically adds the stations to the database.

#### B.8.4 Editing / Deleting a Station

- **Edit:** Click on a station > edit form > modify information > **Save**.
- **Delete:** Click **Delete** > confirm (deletes all associated data).

### B.9 Managing Water Quality Data

#### B.9.1 Previewing an Excel File

1. **Data** tab > **Water Quality** > **Preview Excel**.
2. Select an Excel file > select Sample Date > **Preview**.
3. The system displays a data preview with QCVN standard comparison.

#### B.9.2 Importing Data

1. After a successful preview, click **Import**.
2. Enable **Overwrite** if you want to replace existing data.
3. Click **Confirm Import**.

#### B.9.3 Deleting a Sample

Click **Delete** next to the sample you want to remove > confirm.

### B.10 Adding Images

#### B.10.1 Station Images

1. Upload the image to S3 at `station-data/manual-stations/`.
2. Record the image code (imageCode).
3. Update the imageCode for the corresponding station via the **Manual Stations** tab.

#### B.10.2 Article Images

1. Upload the image to S3 at `news-images/{article-slug}/`.
2. When creating/editing an article, enter the image URL in the **Image URL** field.

### B.11 Configuring Popups

Object information popups are configured on the backend. To change the popup content:

1. Edit the configuration file in the backend source code.
2. Redeploy the backend.

> *There is currently no admin interface for configuring popups. This feature will be developed in a future version.*

### B.12 Configuring the Legend

The legend is automatically generated based on layer data. To modify it:

1. Update the styles/colors in the frontend configuration file.
2. Redeploy the frontend.

### B.13 User Account Management

#### B.13.1 Viewing the User List (ADMIN)

Go to the **Users** tab to view the user table: ID, Username, Email, Role, Enabled, Created At.

#### B.13.2 Adding a New User (ADMIN)

1. Click **Add User**.
2. Enter Username, Email, Password.
3. Select Role (USER / DATA_MANAGER / ADMIN).
4. Enable **Enabled** to activate immediately.
5. Click **Save**.

#### B.13.3 Editing User Information (ADMIN)

1. Click **Edit** next to the user.
2. Modify the information (leave Password blank if not changing).
3. Click **Save**.

> **Note:** ADMIN users cannot change their own role.

#### B.13.4 Disabling / Deleting a User (ADMIN)

- **Disable:** Turn off **Enabled** > Save. Can be reactivated at any time.
- **Delete:** Click **Delete** > confirm. **Cannot be restored.**

### B.14 Managing Articles

#### B.14.1 Creating a New Article (ADMIN)

1. Go to the **Articles** tab > **New Article**.
2. Enter **Title** (slug is auto-generated).
3. Select **Category:** System Update, Data, Announcement, Event, New Feature, Guide.
4. Enter **Content** (supports HTML/rich text).
5. Enter **Excerpt** (2-3 sentence summary).
6. Enter **Tags** (comma-separated).
7. Enter **Image URL** (thumbnail image).
8. Enable **Featured** to mark the article as featured.
9. Enable **Published** to publish immediately (disable = save as draft).
10. Click **Save**.

#### B.14.2 Editing / Deleting an Article (ADMIN)

- **Edit:** Click **Edit** > make changes > **Save**.
- **Delete:** Click **Delete** > **Confirm**.

### B.15 Backup

#### B.15.1 Automatic Backup

| Parameter | Value |
|-----------|-------|
| **Schedule** | Every day at **00:00** |
| **Content** | Full MySQL database |
| **Format** | `backup/mekong-{yyyyMMdd}_{HHmmss}.sql.gz` |
| **Storage Location** | S3 bucket, prefix `backup/` |

#### B.15.2 Manual Backup (ADMIN)

1. Go to the **Overview** tab.
2. Click the **Trigger Backup** button.
3. The system performs: database dump > GZip compression > upload to S3.
4. Verify the backup file in the **Storage** tab > `backup/` prefix.

### B.16 Restoration

To restore data from a backup file:

1. Download the `.sql.gz` file from S3 (**Storage** tab > `backup/` prefix).
2. Decompress: `gunzip backup-file.sql.gz`.
3. Import into MySQL: `mysql -u root -p mekong < backup-file.sql`.

> **Warning:** This operation is for ADMIN only and must be performed directly on the server.

### B.17 Data Fetch & Export

#### B.17.1 Manual Data Fetch

**Ecowitt (Weather Data):**

1. **Data** tab > select **Ecowitt** source.
2. Select a device from the dropdown list.
3. Select a date > click **Fetch Data**.

**Mekong API (Hydrological Data):**

1. **Data** tab > select **Mekong** source.
2. Select a date > click **Fetch Data**.

#### B.17.2 Exporting Data to Excel

1. Click **Export Excel** in the Data tab.
2. Select mode: **Monthly** or **Daily**.
3. Select Metric (Salinity, pH, WaterLevel, Alkalinity).
4. Select Province (Tra Vinh, Ben Tre, Vinh Long).
5. Select Time period > click **Export**.

### B.18 Landuse Computation

1. Go to the **GIS** tab > **Landuse Compute**.
2. View land use area statistics by year.
3. Click **Compute** to rerun the computation (asynchronous).
4. Monitor progress via **Compute Status**.
5. Click **Inventory** to check which raster files have been processed.

### B.19 CORS and IP Configuration

When the server IP address changes:

- **Recommended:** Run `./manage.sh` > select option `9` (Change IP).
- **Manual:** Edit `application.yaml` (allowedOrigins) and `.env.local` (NEXT_PUBLIC_API_URL).

To change a user's role via MySQL in an emergency:

```sql
USE mekong;
-- View all users
SELECT id, username, email, role, enabled FROM users;
-- Change role
UPDATE users SET role = 'DATA_MANAGER' WHERE username = 'user';
-- Disable an account
UPDATE users SET enabled = false WHERE username = 'old_user';
```

> **Warning:** Back up your data before operating directly on MySQL!

---

## Appendices

### Detailed Permissions Table

| Function | USER | DATA_MANAGER | ADMIN |
|----------|:----:|:------------:|:-----:|
| View WebGIS Map | Yes | Yes | Yes |
| View News | Yes | Yes | Yes |
| Download Public Data | Yes | Yes | Yes |
| Login / Registration | Yes | Yes | Yes |
| Dashboard Overview | No | Yes | Yes |
| Upload S3 Files | No | Yes | Yes |
| Delete S3 Files | No | Yes | Yes |
| Create/Copy/Rename S3 Folders | No | Yes | Yes |
| Manage GIS Layers | No | Yes | Yes |
| Manage Monitoring Stations | No | Yes | Yes |
| Import Water Quality Data | No | Yes | Yes |
| Manage Articles (CRUD) | No | No | Yes |
| Trigger Data Fetch | No | Yes | Yes |
| Export Excel | No | Yes | Yes |
| Compute Landuse | No | Yes | Yes |
| Manage Users | No | No | Yes |
| Trigger Backup | No | No | Yes |

### Access Information

| Information | Value |
|-------------|-------|
| **Frontend URL** | `https://mekongsaltlab.org` |
| **Backend API URL** | `http://103.54.251.212:8084` |
| **Swagger API Docs** | `https://mekongsaltlab.org/swagger-ui/` |

### Default Accounts

| Role | Username | Password |
|------|----------|----------|
| USER | `user` | `user123` |
| DATA_MANAGER | `manager` | `manager123` |
| ADMIN | `admin` | `admin123` |

> **Important:** Change your password immediately after the first login!

### Glossary

| Term | Explanation |
|------|-------------|
| **WebGIS** | Web-based Geographic Information System, powered by OpenLayers 10.9 |
| **Frontend** | User interface (Next.js 15 + React 19) |
| **Backend** | Server-side processing (Spring Boot 4.0, Java 17) |
| **API** | Communication between Frontend and Backend (RESTful, JSON) |
| **S3** | Centralized file storage (S3-compatible object storage) |
| **GeoTIFF** | Image file with embedded geospatial coordinates |
| **COG** | Cloud Optimized GeoTIFF – optimized for web delivery |
| **GeoJSON** | Vector JSON format for geospatial data |
| **DXF** | AutoCAD technical drawing format, converted to GeoJSON |
| **JWT** | JSON Web Token – user authentication |
| **UTM 48N** | Map coordinate system (EPSG:32648) for the Mekong Delta |
| **Layer** | A data layer on the map (raster/vector) |
| **Raster** | Grid-based data (pixels) |
| **Vector** | Geometric object data (points, lines, polygons) |

---

*Copyright 2026 MekongSaltLab. WebGIS User and Administration Manual – Version 1.0.*  
*Drafted by Hoang and Duy.*
