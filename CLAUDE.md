# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

迹影地图 (TraceMap) v2 — A local-first photo map diary app built with Capacitor 6 + AMap (Gaode Map) JS API.

**Key concept**: Import photos, auto-extract GPS from EXIF, display on map. Photos without GPS go to a pending/manual-location list.

**Tech stack**: Capacitor 6, vanilla JS (no framework), AMap JS API 2.0, IndexedDB + localStorage for persistence.

**Key folders**:
- `www/index.html` — Complete single-page app (v2 rebuild, ~2000 lines of JS)
- `android/app/src/main/java/com/jiying/map/` — Android native plugins (Java)

## Build Commands

```bash
# Sync Capacitor web assets to Android
npx cap sync

# Build Android debug APK
npx cap sync && cd android && ./gradlew assembleDebug

# Open in Android Studio
npx cap open android
```

## Architecture — v2 (Current)

### Web Frontend (`www/index.html`)
Single-file app with these views, navigated via bottom tab bar:
1. **Map** (`#page-map`) — AMap with photo markers. GPS photos auto-appear. Date-filter chips overlay.
2. **Album** (`#page-album`) — Photo grid grouped by date, with GPS indicators.
3. **Pending** (`#page-pending`) — Photos without GPS, with failure reasons and manual location actions.
4. **Import** (`#page-import`) — Import button + progress UI. Platform-aware import pipeline.
5. **Debug** (`#page-debug`) — Platform info, photo stats, native plugin status, detailed import logs.

### Import Pipeline (Platform-Aware)

**Android (Capacitor)**:
1. User taps import → `startImport()` detects Capacitor/Android
2. Calls `Capacitor.Plugins.NativePhotoExif.pickImagesWithLocation()`
3. Native Android plugin opens system photo picker
4. Plugin reads GPS via `ExifInterface` + `MediaStore.setRequireOriginal()` from original `content://` URIs
5. Plugin copies photos to app cache, returns `{ photos: [{uri, webPath, nativeLocation: {lat, lng, takenAt, ...}}] }`
6. Frontend stores metadata, generates thumbnails, converts GPS→Gaode coords for map display
7. Photos with GPS → map; without → pending list

**Web Browser**:
1. User taps import → `startImport()` detects web platform
2. Creates `<input type="file" multiple accept="image/*">`
3. **Before any processing**, reads EXIF GPS from the original File/Blob via JavaScript binary parser
4. Generates thumbnails AFTER GPS extraction
5. Same storage flow as Android

### Native Android Plugin (`NativePhotoExifPlugin.java`)

Registered in `MainActivity.java` via `registerPlugin(NativePhotoExifPlugin.class)`.

Key methods:
- `pickImagesWithLocation({ limit })` — Opens system picker, returns photos with GPS results
- `getLocationFromUri({ uri })` — Reads GPS from a single content:// URI

GPS reading approach:
1. Checks/requests `ACCESS_MEDIA_LOCATION` permission (Android 10+)
2. On Android 10+: attempts `MediaStore.setRequireOriginal()` to get original photo with EXIF
3. Opens `ExifInterface` via ContentResolver input stream
4. Extracts GPS via `exif.getLatLong()`
5. Also extracts `takenAt` (date/time), camera make/model from EXIF
6. Falls back to file:// URI if content:// fails

Logging: All logs use tag `TraceMapGPS`. Debug with: `adb logcat -s TraceMapGPS:*`

### Data Model

Each photo stored with these key fields:
- `id`, `fileName`, `mimeType`, `size`
- `lat`, `lng` — Original GPS coordinates
- `displayLat`, `displayLng` — Gaode (GCJ-02) converted coordinates for map
- `takenAt`, `importedAt` — ISO timestamps
- `gpsSource` — `'android_exif_original'` | `'js_exif_fallback'` | `'manual'` | `'context_time'`
- `gpsStatus` — `'OK'` | `'NO_GPS'` | `'NO_PERMISSION'` | etc.
- `gpsFailureMessage` — Human-readable failure explanation (Chinese)
- `locationStatus` — `'located'` | `'pending'` | `'failed'`
- `locationSource` — `'exif'` | `'manual'` | `'context_time'` | `'unknown'`
- `imageData` — WebPath/cache path for display
- `thumbnailData` — Base64 thumbnail (also stored in IndexedDB via `thumbnailId`)

### Storage

- **localStorage**: Photo metadata array (`tracemap_v2_meta` key). Falls back to old `jiying_photo_meta_v2` key for migration.
- **IndexedDB**: `tracemap_v2` database, `thumbs` object store for base64 thumbnails.

### Delete Features

- Single delete: from photo detail modal, with confirmation dialog
- Multi-delete: long-press on album page enters delete mode, tap to select, confirm to batch delete
- Deletion removes: metadata, thumbnail from IndexedDB, photo record from state

### AMap (Gaode) Integration

- GPS coordinates (WGS-84) must be converted to GCJ-02 via `AMap.convertFrom()` before display
- Map created with `AMap.Map` in the `#map-container` div
- Markers use color-coded circular markers (green=mint, red=primary, amber=amber)
- Marker clustering enabled for >50 markers

## Design System

v2 uses a warm, playful "photo diary" aesthetic:
- Background: `#FFF8F3` (warm cream)
- Primary: `#FF7676` (coral pink)
- Accent: `#FFB347` (warm orange)
- Sky: `#74B9FF` (blue)
- Mint: `#55C9A6` (green)
- Text: `#4A3728` (warm dark brown)
- Original mascot character: SVG camera buddy

## Files to Ignore

The old v1/v3 modular JS files in `www/js/` are no longer referenced by the new index.html:
- `tracemap-data.js`, `tracemap-patch.js`, `tracemap-ui.js`, `tracemap-inference.js`, `tracemap-export.js`, `tracemap-places.js`
- These can be removed if desired but are harmless if left.
