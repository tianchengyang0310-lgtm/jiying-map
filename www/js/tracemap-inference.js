/**
 * 迹影地图 — 上下文位置推理引擎
 * 根据时间邻近和同天聚集，为无 GPS 照片推荐位置
 */

// ═══════════════════════════════════════════════════════════════
// LocationCandidate 结构
// ═══════════════════════════════════════════════════════════════
/**
 * @typedef {Object} LocationCandidate
 * @property {number} lat
 * @property {number} lng
 * @property {number} confidence
 * @property {number} accuracyRadius
 * @property {'context_time'|'context_place'} source
 * @property {string} reason
 * @property {string[]} basedOnPhotoIds
 */

// ═══════════════════════════════════════════════════════════════
// 主推理函数
// ═══════════════════════════════════════════════════════════════
function inferLocationByContext(targetPhoto, allPhotos) {
  if (!targetPhoto || !allPhotos || allPhotos.length === 0) return [];

  // 只使用有位置的照片作为参考
  var refPhotos = allPhotos.filter(function (p) {
    return p.id !== targetPhoto.id && isValidCoordinate(Number(p.lat), Number(p.lng));
  });

  if (refPhotos.length === 0) return [];

  var candidates = [];

  // 规则1: 时间邻近推理（同一天 + 时间差）
  var targetTime = targetPhoto.takenAt || targetPhoto.shootTime;
  if (targetTime) {
    var timeCandidates = inferByTimeProximity(targetTime, refPhotos);
    candidates = candidates.concat(timeCandidates);
  }

  // 规则2: 同一天地点聚类
  var dayCandidates = inferByDayCluster(targetPhoto, refPhotos);
  candidates = candidates.concat(dayCandidates);

  // 去重、排序（confidence 高在前）
  candidates = deduplicateCandidates(candidates);
  candidates.sort(function (a, b) { return b.confidence - a.confidence; });

  return candidates.slice(0, 5); // 最多返回 5 个候选
}

// ═══════════════════════════════════════════════════════════════
// 规则1: 时间邻近推理
// ═══════════════════════════════════════════════════════════════
function inferByTimeProximity(targetTime, refPhotos) {
  var targetMs = new Date(targetTime).getTime();
  if (isNaN(targetMs)) return [];

  var candidates = [];
  var targetDay = fmtFull(targetTime).dateKey;

  refPhotos.forEach(function (ref) {
    var refTime = ref.takenAt || ref.shootTime || ref.importedAt || ref.importTime;
    if (!refTime) return;
    var refMs = new Date(refTime).getTime();
    if (isNaN(refMs)) return;

    var diffMin = Math.abs(targetMs - refMs) / 60000; // 分钟

    var confidence, accuracyRadius;
    if (diffMin <= 10) {
      confidence = 0.85;
      accuracyRadius = 200;
    } else if (diffMin <= 30) {
      confidence = 0.70;
      accuracyRadius = 500;
    } else if (diffMin <= 60) {
      confidence = 0.55;
      accuracyRadius = 1000;
    } else {
      return; // 超过 60 分钟不按时间推理
    }

    // 只有同一天才用时间推理（跨天可能是不同地点）
    var refDay = fmtFull(refTime).dateKey;
    if (refDay !== targetDay && diffMin > 30) return;

    var lat = Number(ref.lat);
    var lng = Number(ref.lng);

    if (isValidCoordinate(lat, lng)) {
      var reason = '根据同一天前后 ' + Math.round(diffMin) + ' 分钟内的已定位照片推测';
      candidates.push({
        lat: lat,
        lng: lng,
        confidence: confidence,
        accuracyRadius: accuracyRadius,
        source: 'context_time',
        reason: reason,
        basedOnPhotoIds: [ref.id]
      });
    }
  });

  return candidates;
}

// ═══════════════════════════════════════════════════════════════
// 规则2: 同一天地点聚类推理
// ═══════════════════════════════════════════════════════════════
function inferByDayCluster(targetPhoto, refPhotos) {
  var targetTime = targetPhoto.takenAt || targetPhoto.shootTime;
  if (!targetTime) return [];

  var targetDay = fmtFull(targetTime).dateKey;

  // 筛选同一天的参考照片
  var dayRefs = refPhotos.filter(function (ref) {
    var refTime = ref.takenAt || ref.shootTime || ref.importedAt || ref.importTime;
    if (!refTime) return false;
    return fmtFull(refTime).dateKey === targetDay;
  });

  if (dayRefs.length < 2) return [];

  // 简单聚类：把同一天照片按 500m 半径分组
  var clusters = clusterPhotosByDistance(dayRefs, 500);

  // 取最大的聚类作为候选（排除只有 1 张的）
  var mainCluster = null;
  clusters.forEach(function (cluster) {
    if (cluster.length >= 2 && (!mainCluster || cluster.length > mainCluster.length)) {
      mainCluster = cluster;
    }
  });

  if (!mainCluster || mainCluster.length < 2) return [];

  // 计算聚类中心
  var centerLat = 0, centerLng = 0;
  mainCluster.forEach(function (p) {
    centerLat += Number(p.lat);
    centerLng += Number(p.lng);
  });
  centerLat /= mainCluster.length;
  centerLng /= mainCluster.length;

  // 计算聚类半径
  var maxDist = 0;
  mainCluster.forEach(function (p) {
    var d = haversineDistance(centerLat, centerLng, Number(p.lat), Number(p.lng));
    if (d > maxDist) maxDist = d;
  });

  var reason = '根据同一天 ' + mainCluster.length + ' 张已定位照片的聚集区域推测';
  return [{
    lat: centerLat,
    lng: centerLng,
    confidence: 0.60,
    accuracyRadius: Math.max(maxDist * 1000, 300), // 转换为米
    source: 'context_place',
    reason: reason,
    basedOnPhotoIds: mainCluster.map(function (p) { return p.id; })
  }];
}

// ═══════════════════════════════════════════════════════════════
// 简易距离聚类（替代 DBSCAN）
// ═══════════════════════════════════════════════════════════════
function clusterPhotosByDistance(photos, radiusMeters) {
  if (photos.length === 0) return [];

  var visited = {};
  var clusters = [];

  photos.forEach(function (p, i) {
    if (visited[p.id]) return;

    var cluster = [p];
    visited[p.id] = true;

    // BFS 扩展
    var queue = [p];
    while (queue.length > 0) {
      var current = queue.shift();
      photos.forEach(function (other) {
        if (visited[other.id]) return;
        var dist = haversineDistance(
          Number(current.lat), Number(current.lng),
          Number(other.lat), Number(other.lng)
        );
        if (dist * 1000 <= radiusMeters) { // dist 是 km，radiusMeters 是 m
          visited[other.id] = true;
          cluster.push(other);
          queue.push(other);
        }
      });
    }

    clusters.push(cluster);
  });

  return clusters;
}

// ═══════════════════════════════════════════════════════════════
// Haversine 距离计算（返回公里）
// ═══════════════════════════════════════════════════════════════
function haversineDistance(lat1, lng1, lat2, lng2) {
  var R = 6371; // 地球半径 km
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLng = (lng2 - lng1) * Math.PI / 180;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ═══════════════════════════════════════════════════════════════
// 候选去重（0.001 度 ≈ 111m，非常近的合并）
// ═══════════════════════════════════════════════════════════════
function deduplicateCandidates(candidates) {
  var unique = [];
  candidates.forEach(function (c) {
    var isDuplicate = unique.some(function (u) {
      return haversineDistance(c.lat, c.lng, u.lat, u.lng) * 1000 < 100;
    });
    if (!isDuplicate) unique.push(c);
  });
  return unique;
}

// ═══════════════════════════════════════════════════════════════
// AI 候选接口预留（当前返回空，后续接入 GeoAgent/GeoSeek）
// ═══════════════════════════════════════════════════════════════
function inferLocationByAI(photo) {
  // TODO: 接入 GeoAgent (CVPR 2026) / GeoSeek 数据集训练的模型
  // 可以接入的方式：
  // 1. 本地 Ollama + 多模态模型
  // 2. 远程 API 调用
  // 3. 浏览器端 WebGPU/ONNX 推理
  return Promise.resolve([]);
}

// ═══════════════════════════════════════════════════════════════
// 为一张待定位照片获取所有候选位置
// ═══════════════════════════════════════════════════════════════
function getLocationCandidatesForPhoto(photo, allPhotos) {
  var contextCandidates = inferLocationByContext(photo, allPhotos);
  return {
    context: contextCandidates,
    ai: [] // 预留
  };
}

// ═══════════════════════════════════════════════════════════════
// 确认位置候选
// ═══════════════════════════════════════════════════════════════
function confirmLocationCandidate(photo, candidate) {
  if (!photo || !candidate) return false;

  photo.lat = candidate.lat;
  photo.lng = candidate.lng;
  photo.locationStatus = 'located';
  photo.locationSource = candidate.source;
  photo.confidence = candidate.confidence;
  photo.accuracyRadius = candidate.accuracyRadius;
  photo.hasLocation = true;
  photo.gpsFailure = null;
  photo.gpsFailureMessage = null;

  if (!photo.inference) photo.inference = {};
  photo.inference.reason = candidate.reason;
  photo.inference.basedOnPhotoIds = candidate.basedOnPhotoIds || [];
  photo.inference.method = candidate.source;

  if (photo.locationSource !== 'manual') {
    photo.gpsSource = candidate.source;
  }

  // 清除旧 display 坐标（后续会重新计算）
  photo.displayLat = null;
  photo.displayLng = null;

  return true;
}
