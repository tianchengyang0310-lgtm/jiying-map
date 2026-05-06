/**
 * 迹影地图 — 数据模块
 * 统一 PhotoRecord 数据结构、IndexedDB 存储增强、元数据管理
 */

// ═══════════════════════════════════════════════════════════════
// PhotoRecord 数据结构（JSDoc 类型说明）
// ═══════════════════════════════════════════════════════════════
/**
 * @typedef {'exif'|'manual'|'context_time'|'context_place'|'ai_candidate'|'unknown'} LocationSource
 * @typedef {'located'|'pending'|'failed'} PhotoLocationStatus
 *
 * @typedef {Object} ExifRaw
 * @property {string} [make]
 * @property {string} [model]
 * @property {string} [lensModel]
 * @property {string} [dateTimeOriginal]
 * @property {number} [gpsLatitude]
 * @property {number} [gpsLongitude]
 * @property {number} [gpsAltitude]
 *
 * @typedef {Object} InferenceInfo
 * @property {string} [reason]
 * @property {string[]} [basedOnPhotoIds]
 * @property {string} [method]
 *
 * @typedef {Object} PhotoRecord
 * @property {string} id
 * @property {string} fileName
 * @property {string} mimeType
 * @property {number} size
 * @property {string} [takenAt]
 * @property {string} importedAt
 * @property {number} [lat]
 * @property {number} [lng]
 * @property {number} [altitude]
 * @property {PhotoLocationStatus} locationStatus
 * @property {LocationSource} locationSource
 * @property {number} confidence
 * @property {number} [accuracyRadius]
 * @property {string} [addressText]
 * @property {string} [note]
 * @property {string[]} [tags]
 * @property {string} [imageBlobId]
 * @property {string} [thumbnailBlobId]
 * @property {ExifRaw} [exifRaw]
 * @property {InferenceInfo} [inference]
 */

// ═══════════════════════════════════════════════════════════════
// 创建标准 PhotoRecord
// ═══════════════════════════════════════════════════════════════
function createPhotoRecord(opts) {
  var now = new Date().toISOString();
  return {
    id: opts.id || ('p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)),
    fileName: opts.fileName || 'IMG.jpg',
    mimeType: opts.mimeType || 'image/jpeg',
    size: opts.size || 0,

    takenAt: opts.takenAt || null,
    importedAt: opts.importedAt || now,

    lat: opts.lat !== undefined && isValidCoordinate(opts.lat, opts.lng) ? opts.lat : null,
    lng: opts.lng !== undefined && isValidCoordinate(opts.lat, opts.lng) ? opts.lng : null,
    altitude: opts.altitude || null,

    locationStatus: opts.locationStatus || (isValidCoordinate(opts.lat, opts.lng) ? 'located' : 'pending'),
    locationSource: opts.locationSource || (isValidCoordinate(opts.lat, opts.lng) ? 'exif' : 'unknown'),

    confidence: opts.confidence !== undefined ? opts.confidence : (isValidCoordinate(opts.lat, opts.lng) ? 1.0 : 0),
    accuracyRadius: opts.accuracyRadius !== undefined ? opts.accuracyRadius : (isValidCoordinate(opts.lat, opts.lng) ? 30 : null),

    addressText: opts.addressText || opts.address || null,
    note: opts.note || '',
    tags: opts.tags || [],

    imageBlobId: opts.imageBlobId || null,
    thumbnailBlobId: opts.thumbnailBlobId || null,

    exifRaw: opts.exifRaw || null,
    inference: opts.inference || null,

    // 兼容旧字段（内部使用）
    imageData: opts.imageData || null,
    thumbnailData: opts.thumbnailData || null,
    displayLat: opts.displayLat || null,
    displayLng: opts.displayLng || null,
    hasLocation: isValidCoordinate(opts.lat, opts.lng),
    gpsSource: opts.locationSource || null,
    gpsFailure: opts.gpsFailure || null,
    gpsFailureMessage: opts.gpsFailureMessage || null,
    sourceUri: opts.sourceUri || null,
    cameraMake: opts.exifRaw ? opts.exifRaw.make : (opts.cameraMake || null),
    cameraModel: opts.exifRaw ? opts.exifRaw.model : (opts.cameraModel || null),
    shootTime: opts.takenAt || opts.shootTime || null,
    importTime: opts.importedAt || now
  };
}

// ═══════════════════════════════════════════════════════════════
// 将旧格式照片迁移到新数据结构
// ═══════════════════════════════════════════════════════════════
function migratePhotoToNewFormat(p) {
  if (!p || typeof p !== 'object') return null;

  var lat = Number(p.lat);
  var lng = Number(p.lng);
  var hasLoc = isValidCoordinate(lat, lng);

  var exifRaw = null;
  if (p.cameraMake || p.cameraModel || p.shootTime) {
    exifRaw = {
      make: p.cameraMake || null,
      model: p.cameraModel || null,
      dateTimeOriginal: p.shootTime || null,
      gpsLatitude: hasLoc ? lat : null,
      gpsLongitude: hasLoc ? lng : null
    };
  }

  // 确定 locationSource
  var locationSource = 'unknown';
  if (hasLoc) {
    if (p.gpsSource) {
      if (p.gpsSource.indexOf('exif') >= 0 || p.gpsSource.indexOf('capacitor') >= 0 || p.gpsSource === 'js_exif_fallback') {
        locationSource = 'exif';
      } else if (p.gpsSource.indexOf('manual') >= 0) {
        locationSource = 'manual';
      } else if (p.gpsSource.indexOf('context') >= 0) {
        locationSource = 'context_time';
      } else {
        locationSource = 'exif';
      }
    } else {
      locationSource = 'exif';
    }
  }

  return {
    id: p.id,
    fileName: p.fileName || p.filename || 'IMG.jpg',
    mimeType: p.mimeType || 'image/jpeg',
    size: p.size || 0,

    takenAt: p.shootTime || p.datetime || null,
    importedAt: p.importTime || p.importedAt || new Date().toISOString(),

    lat: hasLoc ? lat : null,
    lng: hasLoc ? lng : null,
    altitude: p.altitude || null,

    locationStatus: hasLoc ? 'located' : (p.gpsFailure ? 'failed' : 'pending'),
    locationSource: locationSource,

    confidence: hasLoc ? 1.0 : 0,
    accuracyRadius: hasLoc ? 30 : null,

    addressText: p.address || null,
    note: p.note || '',
    tags: p.tags || [],

    imageBlobId: p.imageBlobId || null,
    thumbnailBlobId: p.thumbnailBlobId || null,

    exifRaw: p.exifRaw || exifRaw,
    inference: p.inference || null,

    // 兼容旧字段
    imageData: sanitizeImageData(p.imageData || p.url || p.src || '') || null,
    thumbnailData: sanitizeImageData(p.thumbnailData || p.thumbUrl || '') || null,
    displayLat: p.displayLat || (hasLoc ? lat : null),
    displayLng: p.displayLng || (hasLoc ? lng : null),
    hasLocation: hasLoc,
    gpsSource: p.gpsSource || locationSource,
    gpsFailure: p.gpsFailure || null,
    gpsFailureMessage: p.gpsFailureMessage || null,
    sourceUri: p.sourceUri || null,
    cameraMake: p.cameraMake || (exifRaw ? exifRaw.make : null),
    cameraModel: p.cameraModel || (exifRaw ? exifRaw.model : null),
    shootTime: p.shootTime || p.datetime || null,
    importTime: p.importTime || p.importedAt || new Date().toISOString(),
    _idx: p._idx !== undefined ? p._idx : -1
  };
}

// ═══════════════════════════════════════════════════════════════
// 增强的元数据存储（包含所有新字段）
// ═══════════════════════════════════════════════════════════════
var META_KEY_V2 = 'jiying_photo_meta_v2';

function saveMetadataV2(photos) {
  try {
    var meta = photos.map(function (p) {
      return {
        id: p.id,
        fileName: p.fileName,
        mimeType: p.mimeType || 'image/jpeg',
        size: p.size || 0,
        takenAt: p.takenAt || p.shootTime || null,
        importedAt: p.importedAt || p.importTime || new Date().toISOString(),
        lat: p.lat,
        lng: p.lng,
        altitude: p.altitude || null,
        locationStatus: p.locationStatus || (p.hasLocation ? 'located' : (p.gpsFailure ? 'failed' : 'pending')),
        locationSource: p.locationSource || (p.gpsSource || 'unknown'),
        confidence: p.confidence !== undefined ? p.confidence : (p.hasLocation ? 1.0 : 0),
        accuracyRadius: p.accuracyRadius !== undefined ? p.accuracyRadius : (p.hasLocation ? 30 : null),
        addressText: p.addressText || p.address || null,
        note: p.note || '',
        tags: p.tags || [],
        imageBlobId: p.imageBlobId || null,
        thumbnailBlobId: p.thumbnailBlobId || null,
        exifRaw: p.exifRaw || null,
        inference: p.inference || null,
        // 旧字段兼容
        displayLat: p.displayLat,
        displayLng: p.displayLng,
        hasLocation: p.hasLocation,
        gpsSource: p.gpsSource,
        gpsFailure: p.gpsFailure,
        gpsFailureMessage: p.gpsFailureMessage,
        sourceUri: p.sourceUri,
        cameraMake: p.cameraMake,
        cameraModel: p.cameraModel,
        shootTime: p.shootTime || p.takenAt,
        importTime: p.importTime || p.importedAt
      };
    });
    localStorage.setItem(META_KEY_V2, JSON.stringify(meta));
  } catch (e) {
    console.error('保存元数据失败:', e);
    showToast && showToast('存储空间不足', 'warn');
  }
}

function loadMetadataV2() {
  try {
    // 优先读取 V2
    var raw = localStorage.getItem(META_KEY_V2);
    if (raw) {
      var arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) return arr;
    }
    // 兼容旧版
    raw = localStorage.getItem('jiying_photo_meta');
    if (raw) {
      var oldArr = JSON.parse(raw);
      if (Array.isArray(oldArr) && oldArr.length > 0) return oldArr;
    }
    return [];
  } catch (e) {
    console.warn('读取元数据失败:', e);
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════
// 增强 EXIF 解析：读取高度、镜头型号等
// ═══════════════════════════════════════════════════════════════
function parseExifEnhanced(buf) {
  var raw = readExif(buf); // 使用现有解析器
  if (!raw) return null;

  return {
    make: raw.make || null,
    model: raw.model || null,
    lensModel: raw.lensModel || null,
    dateTimeOriginal: raw.dt ? parseExifDateTime(raw.dt) : null,
    gpsLatitude: raw._glat !== undefined ? raw._glat : null,
    gpsLongitude: raw._glon !== undefined ? raw._glon : null,
    gpsAltitude: raw._galt !== undefined ? raw._galt : null,
    orientation: raw.ori || null
  };
}

// ═══════════════════════════════════════════════════════════════
// GPS 失败原因说明（中文）
// ═══════════════════════════════════════════════════════════════
function getGpsFailureExplanation(photo) {
  if (!photo) return '';

  if (photo.locationStatus === 'located') return '';

  var reasons = [];
  if (photo.gpsFailure) {
    switch (photo.gpsFailure) {
      case 'NO_GPS':
        reasons.push('原图本身没有 GPS 位置信息');
        break;
      case 'NO_PERMISSION':
        reasons.push('没有读取照片元数据的权限');
        break;
      case 'NO_URI':
        reasons.push('照片来源不支持读取原始文件');
        break;
      case 'INVALID_URI':
        reasons.push('原始照片文件不可用');
        break;
      case 'READ_FAILED':
        reasons.push('读取原始照片元数据失败');
        break;
      default:
        reasons.push(photo.gpsFailure);
    }
  }

  // 额外说明
  reasons.push('可能原因：');
  reasons.push('• 原图本身无 GPS 位置');
  reasons.push('• 从社交软件保存导致 EXIF 被清除');
  reasons.push('• 浏览器/系统选择器未暴露完整元数据');

  return reasons.join('\n');
}

// ═══════════════════════════════════════════════════════════════
// 获取照片的显示用坐标
// ═══════════════════════════════════════════════════════════════
function getPhotoDisplayPoint(photo) {
  if (!photo) return null;
  // 优先使用 displayLat/displayLng（已转换为高德坐标）
  var dLat = Number(photo.displayLat);
  var dLng = Number(photo.displayLng);
  if (isValidCoordinate(dLat, dLng)) return { lat: dLat, lng: dLng };
  // 降级使用原始坐标
  var lat = Number(photo.lat);
  var lng = Number(photo.lng);
  if (isValidCoordinate(lat, lng)) return { lat: lat, lng: lng };
  return null;
}

// ═══════════════════════════════════════════════════════════════
// 统计信息
// ═══════════════════════════════════════════════════════════════
function getLocationStats(photos) {
  var located = 0, pending = 0, failed = 0, exif = 0, manual = 0, context = 0;
  photos.forEach(function (p) {
    switch (p.locationStatus) {
      case 'located': located++; break;
      case 'pending': pending++; break;
      case 'failed': failed++; break;
      default:
        if (p.hasLocation) located++;
        else pending++;
    }
    switch (p.locationSource) {
      case 'exif': exif++; break;
      case 'manual': manual++; break;
      case 'context_time':
      case 'context_place': context++; break;
    }
  });
  return { located: located, pending: pending, failed: failed, exif: exif, manual: manual, context: context };
}

// ═══════════════════════════════════════════════════════════════
// 索引：按日期分组
// ═══════════════════════════════════════════════════════════════
function indexPhotosByDate(photos) {
  var byDate = {};
  photos.forEach(function (p) {
    var useTime = p.takenAt || p.shootTime || p.importedAt || p.importTime;
    var d = fmtFull(useTime);
    var dk = d.dateKey;
    if (!byDate[dk]) byDate[dk] = [];
    byDate[dk].push(p);
  });
  var dates = Object.keys(byDate).sort().reverse();
  return { byDate: byDate, dates: dates };
}
