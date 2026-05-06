/**
 * 迹影地图 — 数据导出模块
 * 支持 CSV 和 GeoJSON 格式导出
 */

// ═══════════════════════════════════════════════════════════════
// CSV 导出
// ═══════════════════════════════════════════════════════════════
function exportToCSV(photos) {
  var rows = [];
  // CSV 表头
  rows.push('id,fileName,takenAt,lat,lng,altitude,locationStatus,locationSource,confidence,accuracyRadius,addressText,note,tags');

  photos.forEach(function (p) {
    // 只导出有经纬度的照片
    if (!isValidCoordinate(Number(p.lat), Number(p.lng))) return;

    var takenAt = p.takenAt || p.shootTime || '';
    var addressText = (p.addressText || p.address || '').replace(/,/g, '，').replace(/"/g, '""');
    var note = (p.note || '').replace(/,/g, '，').replace(/"/g, '""');
    var tags = (p.tags || []).join(';');
    var fileName = (p.fileName || '').replace(/,/g, '，');

    rows.push([
      p.id,
      '"' + fileName + '"',
      takenAt,
      Number(p.lat).toFixed(6),
      Number(p.lng).toFixed(6),
      p.altitude !== null && p.altitude !== undefined ? Number(p.altitude).toFixed(1) : '',
      p.locationStatus || (p.hasLocation ? 'located' : 'pending'),
      p.locationSource || 'unknown',
      (p.confidence !== undefined ? p.confidence : 1.0).toFixed(2),
      p.accuracyRadius || '',
      '"' + addressText + '"',
      '"' + note + '"',
      tags
    ].join(','));
  });

  return rows.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// GeoJSON 导出
// ═══════════════════════════════════════════════════════════════
function exportToGeoJSON(photos) {
  var features = [];

  photos.forEach(function (p) {
    if (!isValidCoordinate(Number(p.lat), Number(p.lng))) return;

    var feature = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [Number(p.lng), Number(p.lat)]
      },
      properties: {
        id: p.id,
        fileName: p.fileName || '',
        takenAt: p.takenAt || p.shootTime || null,
        locationSource: p.locationSource || 'unknown',
        locationStatus: p.locationStatus || (p.hasLocation ? 'located' : 'pending'),
        confidence: p.confidence !== undefined ? p.confidence : 1.0,
        accuracyRadius: p.accuracyRadius || null,
        altitude: p.altitude || null,
        addressText: p.addressText || p.address || null,
        note: p.note || '',
        tags: p.tags || [],
        cameraMake: p.cameraMake || (p.exifRaw ? p.exifRaw.make : null),
        cameraModel: p.cameraModel || (p.exifRaw ? p.exifRaw.model : null)
      }
    };
    features.push(feature);
  });

  return {
    type: 'FeatureCollection',
    features: features
  };
}

// ═══════════════════════════════════════════════════════════════
// 待定位照片单独 CSV 导出
// ═══════════════════════════════════════════════════════════════
function exportPendingToCSV(photos) {
  var rows = [];
  rows.push('id,fileName,takenAt,locationStatus,gpsFailure,gpsFailureMessage,note');

  photos.forEach(function (p) {
    if (p.locationStatus === 'located' || p.hasLocation) return;
    if (!isValidCoordinate(Number(p.lat), Number(p.lng)) || (!p.lat && !p.lng)) {
      var takenAt = p.takenAt || p.shootTime || '';
      var note = (p.note || '').replace(/,/g, '，').replace(/"/g, '""');
      var fileName = (p.fileName || '').replace(/,/g, '，');

      rows.push([
        p.id,
        '"' + fileName + '"',
        takenAt,
        p.locationStatus || 'pending',
        p.gpsFailure || '',
        (p.gpsFailureMessage || '').replace(/,/g, '，'),
        '"' + note + '"'
      ].join(','));
    }
  });

  return rows.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// 触发文件下载
// ═══════════════════════════════════════════════════════════════
function downloadFile(content, filename, mimeType) {
  var blob = new Blob(['﻿' + content], { type: mimeType + ';charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function downloadCSV(photos) {
  var csv = exportToCSV(photos);
  var ts = new Date().toISOString().slice(0, 10);
  downloadFile(csv, 'jiying-map-export-' + ts + '.csv', 'text/csv');
}

function downloadGeoJSON(photos) {
  var geojson = exportToGeoJSON(photos);
  var ts = new Date().toISOString().slice(0, 10);
  downloadFile(JSON.stringify(geojson, null, 2), 'jiying-map-export-' + ts + '.geojson', 'application/geo+json');
}

function downloadPendingCSV(photos) {
  var csv = exportPendingToCSV(photos);
  var ts = new Date().toISOString().slice(0, 10);
  downloadFile(csv, 'jiying-map-pending-' + ts + '.csv', 'text/csv');
}
