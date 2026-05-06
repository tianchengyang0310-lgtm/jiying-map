/**
 * 迹影地图 — 记忆地点聚类模块
 * 将距离近的照片归为"记忆地点"
 */

// ═══════════════════════════════════════════════════════════════
// 聚类配置
// ═══════════════════════════════════════════════════════════════
var PLACE_CLUSTER_RADIUS = 500; // 默认聚类半径（米）
var PLACE_MIN_PHOTOS = 3;      // 最少照片数才算一个地点

// ═══════════════════════════════════════════════════════════════
// 生成记忆地点
// ═══════════════════════════════════════════════════════════════
function generateMemoryPlaces(photos, radius) {
  radius = radius || PLACE_CLUSTER_RADIUS;

  // 只取有位置的照片
  var locatedPhotos = photos.filter(function (p) {
    return isValidCoordinate(Number(p.lat), Number(p.lng));
  });

  if (locatedPhotos.length === 0) return [];

  // 聚类
  var rawClusters = clusterPhotosByDistance(locatedPhotos, radius);

  // 转换为记忆地点
  var places = [];
  rawClusters.forEach(function (cluster, idx) {
    if (cluster.length < PLACE_MIN_PHOTOS) {
      // 不够最小数量的合并到其他地点或作为零星点
      // 这里简单跳过
      return;
    }

    // 计算中心
    var sumLat = 0, sumLng = 0;
    var times = [];
    var sourceCount = {};
    cluster.forEach(function (p) {
      sumLat += Number(p.lat);
      sumLng += Number(p.lng);
      var t = p.takenAt || p.shootTime;
      if (t) times.push(new Date(t).getTime());
      var src = p.locationSource || 'unknown';
      sourceCount[src] = (sourceCount[src] || 0) + 1;
    });

    var centerLat = sumLat / cluster.length;
    var centerLng = sumLng / cluster.length;

    // 排序时间
    times.sort(function (a, b) { return a - b; });
    var earliest = times.length > 0 ? new Date(times[0]).toISOString() : null;
    var latest = times.length > 0 ? new Date(times[times.length - 1]).toISOString() : null;

    // 计算半径
    var maxDist = 0;
    cluster.forEach(function (p) {
      var d = haversineDistance(centerLat, centerLng, Number(p.lat), Number(p.lng)) * 1000;
      if (d > maxDist) maxDist = d;
    });

    // 确定主要定位来源
    var mainSource = 'exif';
    var maxCount = 0;
    Object.keys(sourceCount).forEach(function (k) {
      if (sourceCount[k] > maxCount) {
        maxCount = sourceCount[k];
        mainSource = k;
      }
    });

    places.push({
      id: 'place_' + idx,
      name: '记忆地点 ' + (idx + 1),
      centerLat: centerLat,
      centerLng: centerLng,
      photoCount: cluster.length,
      earliestTime: earliest,
      latestTime: latest,
      radiusMeters: Math.max(maxDist, 50),
      mainSource: mainSource,
      photoIds: cluster.map(function (p) { return p.id; }),
      sourceStats: sourceCount
    });
  });

  // 按照片数量降序
  places.sort(function (a, b) { return b.photoCount - a.photoCount; });

  // 重新编号
  places.forEach(function (place, i) {
    place.name = '记忆地点 ' + (i + 1);
    place.id = 'place_' + i;
  });

  return places;
}

// ═══════════════════════════════════════════════════════════════
// 时间线模式：获取某一天的照片的路线（连线顺序）
// ═══════════════════════════════════════════════════════════════
function getDayRoute(photos) {
  // 筛选有位置的照片，按时间排序
  var located = photos.filter(function (p) {
    return isValidCoordinate(Number(p.lat), Number(p.lng));
  });

  located.sort(function (a, b) {
    var ta = a.takenAt || a.shootTime || a.importedAt || a.importTime;
    var tb = b.takenAt || b.shootTime || b.importedAt || b.importTime;
    return new Date(ta).getTime() - new Date(tb).getTime();
  });

  if (located.length < 2) return null;

  var points = located.map(function (p) {
    var pt = getPhotoDisplayPoint(p);
    return {
      lat: pt.lat,
      lng: pt.lng,
      photoId: p.id,
      time: p.takenAt || p.shootTime,
      fileName: p.fileName
    };
  });

  return points;
}

// ═══════════════════════════════════════════════════════════════
// 指定日期范围内所有照片的日期列表
// ═══════════════════════════════════════════════════════════════
function getDateList(photos) {
  var dateSet = {};
  photos.forEach(function (p) {
    var t = p.takenAt || p.shootTime || p.importedAt || p.importTime;
    if (t) {
      var dk = fmtFull(t).dateKey;
      dateSet[dk] = (dateSet[dk] || 0) + 1;
    }
  });
  return Object.keys(dateSet).sort().reverse();
}

// ═══════════════════════════════════════════════════════════════
// 获取某日期的所有照片（含待定位）
// ═══════════════════════════════════════════════════════════════
function getPhotosByDate(photos, dateKey) {
  return photos.filter(function (p) {
    var t = p.takenAt || p.shootTime || p.importedAt || p.importTime;
    if (!t) return false;
    return fmtFull(t).dateKey === dateKey;
  });
}
