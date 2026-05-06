/**
 * 迹影地图 — UI 扩展模块
 * 底部 Tab、待定位列表、记忆地点、导出面板、增强 Modal
 * 圆形缩略图 Marker、精度圈按需显示、完整定位元数据弹窗
 */

// ═══════════════════════════════════════════════════════════════
// 初始化扩展 UI
// ═══════════════════════════════════════════════════════════════
function initExtendedUI() {
  injectBottomTabs();
  injectPendingPanel();
  injectPlacesPanel();
  injectExportPanel();
  injectEnhancedStyles();
  bindExtendedEvents();
}

// ═══════════════════════════════════════════════════════════════
// 底部 Tab 栏
// ═══════════════════════════════════════════════════════════════
function injectBottomTabs() {
  var html = '' +
    '<nav id="bottom-tabs">' +
      '<button class="btab active" data-bview="timeline">' +
        '<span class="btab-icon">📷</span>' +
        '<span class="btab-label">照片</span>' +
      '</button>' +
      '<button class="btab" data-bview="map">' +
        '<span class="btab-icon">🗺️</span>' +
        '<span class="btab-label">地图</span>' +
      '</button>' +
      '<button class="btab" data-bview="pending">' +
        '<span class="btab-icon">📍</span>' +
        '<span class="btab-label">待定位</span>' +
        '<span class="btab-badge" id="pending-badge" style="display:none">0</span>' +
      '</button>' +
      '<button class="btab" data-bview="places">' +
        '<span class="btab-icon">🏠</span>' +
        '<span class="btab-label">地点</span>' +
      '</button>' +
      '<button class="btab" data-bview="export">' +
        '<span class="btab-icon">📤</span>' +
        '<span class="btab-label">导出</span>' +
      '</button>' +
    '</nav>';

  var app = document.getElementById('app');
  if (app) {
    app.insertAdjacentHTML('beforeend', html);
  }
}

// ═══════════════════════════════════════════════════════════════
// 待定位列表面板
// ═══════════════════════════════════════════════════════════════
function injectPendingPanel() {
  var html = '' +
    '<div id="pending-panel" class="panel extended-panel">' +
      '<div id="pending-header" style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px">' +
        '<div style="font-size:1rem;font-weight:600">待定位照片</div>' +
        '<div style="font-size:0.72rem;color:var(--text3)" id="pending-count">0 张</div>' +
        '<div style="margin-left:auto;font-size:0.68rem;color:var(--text3);text-align:right;max-width:50%">' +
          '有 GPS 自动上图<br>无 GPS 在此手动补位' +
        '</div>' +
      '</div>' +
      '<div id="pending-list" style="overflow-y:auto;padding:8px 14px 80px;flex:1"></div>' +
      '<div id="pending-empty" class="empty-state" style="display:none;height:auto;padding-top:40vh">' +
        '<div class="empty-icon">✅</div>' +
        '<div class="empty-title">全部已定位</div>' +
        '<div class="empty-desc">所有照片都有位置信息了</div>' +
      '</div>' +
    '</div>';

  var main = document.getElementById('main');
  if (main) {
    main.insertAdjacentHTML('beforeend', html);
  }
}

// ═══════════════════════════════════════════════════════════════
// 记忆地点面板
// ═══════════════════════════════════════════════════════════════
function injectPlacesPanel() {
  var html = '' +
    '<div id="places-panel" class="panel extended-panel">' +
      '<div id="places-header" style="padding:12px 14px;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:10px">' +
        '<div style="font-size:1rem;font-weight:600">记忆地点</div>' +
        '<div style="font-size:0.72rem;color:var(--text3)" id="places-count">-</div>' +
        '<button id="btn-recluster" style="margin-left:auto;padding:5px 12px;background:rgba(0,212,255,0.12);border:1px solid rgba(0,212,255,0.25);color:var(--cyan);border-radius:14px;cursor:pointer;font-size:0.72rem">重新聚类</button>' +
      '</div>' +
      '<div id="places-list" style="overflow-y:auto;padding:8px 14px 80px;flex:1"></div>' +
      '<div id="places-empty" class="empty-state" style="display:none;height:auto;padding-top:40vh">' +
        '<div class="empty-icon">🏠</div>' +
        '<div class="empty-title">暂无记忆地点</div>' +
        '<div class="empty-desc">当有足够多有位置的照片时，<br>系统会自动聚类生成记忆地点</div>' +
      '</div>' +
    '</div>';

  var main = document.getElementById('main');
  if (main) {
    main.insertAdjacentHTML('beforeend', html);
  }
}

// ═══════════════════════════════════════════════════════════════
// 导出面板
// ═══════════════════════════════════════════════════════════════
function injectExportPanel() {
  var html = '' +
    '<div id="export-panel" class="panel extended-panel" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:40px 20px 120px;overflow-y:auto">' +
      '<div style="text-align:center">' +
        '<div style="font-size:2rem;margin-bottom:8px">📤</div>' +
        '<div style="font-size:1rem;font-weight:600;margin-bottom:4px">导出数据</div>' +
        '<div style="font-size:0.72rem;color:var(--text3)">支持 GIS 常用格式，可用于专业地图软件</div>' +
      '</div>' +
      '<div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:320px">' +
        '<button class="export-btn" id="btn-export-geojson">' +
          '<span style="font-size:1.2rem">🗺️</span>' +
          '<div><div style="font-weight:600">GeoJSON</div><div style="font-size:0.68rem;color:var(--text3)">有位置照片导出为 GIS 格式</div></div>' +
        '</button>' +
        '<button class="export-btn" id="btn-export-csv">' +
          '<span style="font-size:1.2rem">📊</span>' +
          '<div><div style="font-weight:600">CSV（已定位）</div><div style="font-size:0.68rem;color:var(--text3)">有位置照片的表格数据</div></div>' +
        '</button>' +
        '<button class="export-btn" id="btn-export-pending">' +
          '<span style="font-size:1.2rem">📋</span>' +
          '<div><div style="font-weight:600">CSV（待定位）</div><div style="font-size:0.68rem;color:var(--text3)">无 GPS 照片清单</div></div>' +
        '</button>' +
      '</div>' +
      '<div style="font-size:0.68rem;color:var(--text3);text-align:center;max-width:280px;line-height:1.6">' +
        'GeoJSON 可用于 QGIS、ArcGIS、Google Earth 等专业 GIS 软件' +
      '</div>' +
    '</div>';

  var main = document.getElementById('main');
  if (main) {
    main.insertAdjacentHTML('beforeend', html);
  }
}

// ═══════════════════════════════════════════════════════════════
// 增强样式
// ═══════════════════════════════════════════════════════════════
function injectEnhancedStyles() {
  var css = '' +
    '/* Bottom Tabs */' +
    '#bottom-tabs{' +
      'position:fixed;bottom:0;left:0;right:0;z-index:900;' +
      'display:flex;justify-content:space-around;align-items:center;' +
      'background:rgba(12,12,24,0.96);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);' +
      'border-top:1px solid var(--glass-border);' +
      'padding:6px 4px max(6px,env(safe-area-inset-bottom));' +
      'height:auto;min-height:50px;' +
    '}' +
    '.btab{' +
      'display:flex;flex-direction:column;align-items:center;gap:2px;' +
      'padding:4px 12px;border:none;background:transparent;color:var(--text3);' +
      'cursor:pointer;font-size:0.62rem;font-weight:500;transition:0.15s;' +
      'position:relative;min-width:48px;' +
    '}' +
    '.btab.active{color:var(--cyan)}' +
    '.btab-icon{font-size:1.1rem;line-height:1}' +
    '.btab-label{white-space:nowrap}' +
    '.btab-badge{' +
      'position:absolute;top:0;right:2px;' +
      'background:var(--amber);color:#000;' +
      'font-size:0.55rem;font-weight:700;' +
      'padding:1px 4px;border-radius:8px;min-width:14px;text-align:center;' +
    '}' +

    '/* Extended panels */' +
    '.extended-panel{' +
      'position:absolute;inset:0;display:flex;flex-direction:column;' +
      'opacity:0;pointer-events:none;transition:opacity 0.35s;' +
    '}' +
    '.extended-panel.active{opacity:1;pointer-events:auto}' +

    '/* Location status badges */' +
    '.loc-badge{' +
      'display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.65rem;font-weight:500;' +
    '}' +
    '.loc-badge.exif{background:rgba(34,197,94,0.15);color:var(--green)}' +
    '.loc-badge.manual{background:rgba(124,58,237,0.15);color:var(--purple)}' +
    '.loc-badge.context{background:rgba(0,212,255,0.12);color:var(--cyan)}' +
    '.loc-badge.unknown{background:rgba(234,179,8,0.12);color:var(--amber)}' +
    '.loc-badge.pending{background:rgba(234,179,8,0.08);color:var(--amber)}' +
    '.loc-badge.located{background:rgba(34,197,94,0.08);color:var(--green)}' +

    '/* Pending photo card */' +
    '.pending-card{' +
      'display:flex;gap:10px;padding:10px;margin-bottom:8px;' +
      'background:var(--card);border:1px solid var(--border);border-radius:var(--rm);' +
      'align-items:center;' +
    '}' +
    '.pending-thumb{width:56px;height:56px;border-radius:8px;object-fit:cover;flex-shrink:0;background:rgba(255,255,255,0.03)}' +
    '.pending-info{flex:1;min-width:0}' +
    '.pending-filename{font-size:0.78rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.pending-time{font-size:0.68rem;color:var(--text3);font-family:monospace}' +
    '.pending-status{font-size:0.65rem;color:var(--text3);margin-top:2px}' +
    '.pending-actions{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}' +
    '.pending-actions button{' +
      'padding:3px 8px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);' +
      'background:rgba(255,255,255,0.04);color:var(--text2);font-size:0.62rem;' +
      'cursor:pointer;white-space:nowrap;' +
    '}' +
    '.pending-actions button:active{background:rgba(255,255,255,0.1)}' +
    '.pending-actions button.primary{background:rgba(0,212,255,0.12);border-color:rgba(0,212,255,0.25);color:var(--cyan)}' +

    '/* Place card */' +
    '.place-card{' +
      'padding:12px 14px;margin-bottom:8px;' +
      'background:var(--card);border:1px solid var(--border);border-radius:var(--rm);' +
      'cursor:pointer;transition:0.15s;' +
    '}' +
    '.place-card:active{background:var(--card-hover)}' +
    '.place-name{font-size:0.9rem;font-weight:600;margin-bottom:4px}' +
    '.place-meta{font-size:0.68rem;color:var(--text3)}' +

    '/* Export button */' +
    '.export-btn{' +
      'display:flex;align-items:center;gap:12px;padding:14px;' +
      'background:var(--card);border:1px solid var(--border);border-radius:var(--rm);' +
      'color:var(--text);cursor:pointer;text-align:left;width:100%;transition:0.15s;' +
    '}' +
    '.export-btn:active{background:var(--card-hover);border-color:var(--glow)}' +

    '/* Date selector for map */' +
    '.date-selector{' +
      'position:absolute;top:50px;left:10px;right:10px;z-index:30;' +
      'display:flex;gap:6px;overflow-x:auto;padding:4px 0;' +
      'scrollbar-width:none;-ms-overflow-style:none;' +
    '}' +
    '.date-selector::-webkit-scrollbar{display:none}' +
    '.date-chip{' +
      'padding:5px 12px;background:rgba(8,8,15,0.78);backdrop-filter:blur(12px);' +
      'border:1px solid rgba(255,255,255,0.08);border-radius:14px;' +
      'color:var(--text2);font-size:0.7rem;white-space:nowrap;cursor:pointer;flex-shrink:0;' +
    '}' +
    '.date-chip.active{background:rgba(0,212,255,0.15);border-color:rgba(0,212,255,0.3);color:var(--cyan)}' +

    '/* Day route info */' +
    '.day-route-info{' +
      'position:absolute;bottom:80px;left:10px;right:10px;z-index:30;' +
      'padding:10px 14px;background:rgba(8,8,15,0.85);backdrop-filter:blur(12px);' +
      'border:1px solid rgba(255,255,255,0.08);border-radius:var(--rm);' +
      'font-size:0.72rem;color:var(--text2);' +
    '}' +

    '/* Candidate list */' +
    '.candidate-list{margin-top:8px;display:flex;flex-direction:column;gap:6px}' +
    '.candidate-item{' +
      'display:flex;align-items:center;gap:8px;padding:8px;' +
      'background:rgba(0,212,255,0.04);border:1px solid rgba(0,212,255,0.12);border-radius:8px;' +
      'cursor:pointer;font-size:0.72rem;transition:0.15s;' +
    '}' +
    '.candidate-item:active{background:rgba(0,212,255,0.1)}' +
    '.candidate-item .ci-conf{' +
      'padding:2px 6px;border-radius:6px;font-size:0.6rem;font-weight:600;' +
      'background:rgba(234,179,8,0.15);color:var(--amber);' +
    '}' +

    '/* Header compact */' +
    '#header.compact{padding-top:max(env(safe-area-inset-top), 8px);padding-bottom:6px}' +
    '#header.compact .tab{padding:4px 10px;font-size:0.72rem}' +

    '/* Map marker popup metadata table */' +
    '.amap-info-content td{padding:2px 4px;font-size:10px}' +
  '';

  var style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  setTimeout(function () {
    var header = document.getElementById('header');
    if (header) header.classList.add('compact');
    var oldTabs = document.querySelector('.view-tabs');
    if (oldTabs) oldTabs.style.display = 'none';
  }, 100);
}

// ═══════════════════════════════════════════════════════════════
// 扩展事件绑定
// ═══════════════════════════════════════════════════════════════
function bindExtendedEvents() {
  document.querySelectorAll('.btab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      switchExtendedView(this.dataset.bview);
    });
  });

  var btnGeoJSON = document.getElementById('btn-export-geojson');
  var btnCSV = document.getElementById('btn-export-csv');
  var btnPending = document.getElementById('btn-export-pending');
  var btnRecluster = document.getElementById('btn-recluster');

  if (btnGeoJSON) btnGeoJSON.addEventListener('click', function () {
    if (typeof downloadGeoJSON === 'function') downloadGeoJSON(S.photos);
    showToast && showToast('GeoJSON 已下载');
  });
  if (btnCSV) btnCSV.addEventListener('click', function () {
    if (typeof downloadCSV === 'function') downloadCSV(S.photos);
    showToast && showToast('CSV 已下载');
  });
  if (btnPending) btnPending.addEventListener('click', function () {
    if (typeof downloadPendingCSV === 'function') downloadPendingCSV(S.photos);
    showToast && showToast('待定位 CSV 已下载');
  });
  if (btnRecluster) btnRecluster.addEventListener('click', function () {
    renderPlacesPanel();
    showToast && showToast('已重新聚类');
  });
}

// ═══════════════════════════════════════════════════════════════
// 扩展视图切换
// ═══════════════════════════════════════════════════════════════
function switchExtendedView(view) {
  document.querySelectorAll('.btab').forEach(function (t) {
    t.classList.toggle('active', t.dataset.bview === view);
  });
  document.querySelectorAll('.panel, .extended-panel').forEach(function (p) {
    p.classList.remove('active');
  });

  switch (view) {
    case 'timeline':
      document.getElementById('timeline').classList.add('active');
      renderTimeline && renderTimeline('');
      break;
    case 'map':
      document.getElementById('map-view').classList.add('active');
      if (!S.map) { initMap && initMap(); }
      else { setTimeout(function () { addMapMarkers && addMapMarkers(); fitMapBounds && fitMapBounds(); }, 200); }
      break;
    case 'pending':
      document.getElementById('pending-panel').classList.add('active');
      renderPendingPanel();
      break;
    case 'places':
      document.getElementById('places-panel').classList.add('active');
      renderPlacesPanel();
      break;
    case 'export':
      document.getElementById('export-panel').classList.add('active');
      break;
    default:
      document.getElementById('timeline').classList.add('active');
  }

  S.view = view;
}

// ═══════════════════════════════════════════════════════════════
// 渲染待定位列表
// ═══════════════════════════════════════════════════════════════
function renderPendingPanel() {
  var list = document.getElementById('pending-list');
  var empty = document.getElementById('pending-empty');
  var count = document.getElementById('pending-count');
  var badge = document.getElementById('pending-badge');

  if (!list) return;

  var pending = S.photos.filter(function (p) {
    return p.locationStatus === 'pending' || p.locationStatus === 'failed' ||
      (!p.hasLocation && (!p.lat || !p.lng));
  });

  if (badge) {
    badge.textContent = pending.length;
    badge.style.display = pending.length > 0 ? 'block' : 'none';
  }

  if (count) {
    count.textContent = pending.length + ' 张';
  }

  if (pending.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (empty) empty.style.display = 'none';

  pending.sort(function (a, b) {
    var ta = a.takenAt || a.shootTime || a.importedAt || a.importTime || '';
    var tb = b.takenAt || b.shootTime || b.importedAt || b.importTime || '';
    return new Date(tb).getTime() - new Date(ta).getTime();
  });

  var html = '';
  pending.forEach(function (p) {
    var thumbSrc = p.thumbnailData || p.imageData || '';
    var timeText = (p.takenAt || p.shootTime) ? fmtDate(p.takenAt || p.shootTime) + ' ' + fmtTime(p.takenAt || p.shootTime) : '未知时间';

    var statusText = '';
    if (p.locationStatus === 'failed') {
      // Show specific gpsFailure reason instead of generic "EXIF读取失败"
      var failReason = (typeof reasonText === 'function') ? reasonText(p.gpsFailure) : (p.gpsFailure || '');
      statusText = failReason || 'EXIF 读取失败';
      if (p.gpsFailureMessage) {
        statusText += ' (' + p.gpsFailureMessage + ')';
      }
    } else if (!p.gpsFailure || p.gpsFailure === 'NO_GPS') {
      statusText = '无 EXIF GPS 信息';
    } else {
      statusText = (typeof reasonText === 'function') ? reasonText(p.gpsFailure) : p.gpsFailure;
    }

    html += '' +
      '<div class="pending-card" data-pid="' + p.id + '">' +
        (thumbSrc
          ? '<img class="pending-thumb" src="' + thumbSrc + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="pending-thumb" style="display:none;align-items:center;justify-content:center;color:var(--text3)">📷</div>'
          : '<div class="pending-thumb" style="display:flex;align-items:center;justify-content:center;color:var(--text3)">📷</div>') +
        '<div class="pending-info">' +
          '<div class="pending-filename" title="' + esc(p.fileName) + '">' + esc(p.fileName) + '</div>' +
          '<div class="pending-time">' + timeText + '</div>' +
          '<div class="pending-status">' + statusText + '</div>' +
          '<div class="pending-actions">' +
            '<button class="primary" onclick="pendingMapPick(\'' + p.id + '\')">地图选点</button>' +
            '<button onclick="pendingUseLastPhoto(\'' + p.id + '\')">用前一张的位置</button>' +
            '<button onclick="pendingShowCandidates(\'' + p.id + '\')">查看推荐</button>' +
            '<button onclick="pendingSkip(\'' + p.id + '\')">暂时跳过</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  });

  list.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════
// 渲染记忆地点面板
// ═══════════════════════════════════════════════════════════════
function renderPlacesPanel() {
  var list = document.getElementById('places-list');
  var empty = document.getElementById('places-empty');
  var countEl = document.getElementById('places-count');

  if (!list) return;

  if (typeof generateMemoryPlaces !== 'function') {
    list.innerHTML = '<div style="padding:20px;color:var(--text3);text-align:center">聚类功能加载中...</div>';
    return;
  }

  var places = generateMemoryPlaces(S.photos, PLACE_CLUSTER_RADIUS);

  if (countEl) countEl.textContent = places.length + ' 个地点';

  if (places.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'flex';
    return;
  }

  if (empty) empty.style.display = 'none';

  var html = '';
  places.forEach(function (place) {
    var earliest = place.earliestTime ? fmtDate(place.earliestTime) : '?';
    var latest = place.latestTime ? fmtDate(place.latestTime) : '?';
    var timeRange = earliest === latest ? earliest : earliest + ' ~ ' + latest;

    var srcText = '';
    if (place.sourceStats) {
      var parts = [];
      Object.keys(place.sourceStats).forEach(function (k) {
        var label = k === 'exif' ? 'EXIF' : k === 'manual' ? '手动' : k === 'context_time' ? '推理' : k;
        parts.push(label + ':' + place.sourceStats[k]);
      });
      srcText = parts.join(' ');
    }

    html += '' +
      '<div class="place-card" onclick="viewPlaceOnMap(\'' + place.id + '\')">' +
        '<div class="place-name">📍 ' + place.name + '</div>' +
        '<div class="place-meta">' +
          place.photoCount + ' 张照片 · ' + timeRange +
          '<br>中心: ' + place.centerLat.toFixed(4) + ', ' + place.centerLng.toFixed(4) +
          ' · 范围: ~' + Math.round(place.radiusMeters) + 'm' +
          (srcText ? '<br>来源: ' + srcText : '') +
        '</div>' +
      '</div>';
  });

  list.innerHTML = html;
  S._places = places;
}

function viewPlaceOnMap(placeId) {
  if (!S._places) return;
  var place = S._places.find(function (p) { return p.id === placeId; });
  if (!place) return;
  switchExtendedView('map');
  setTimeout(function () {
    if (S.map) {
      S.map.setZoomAndCenter(14, [place.centerLng, place.centerLat]);
      addMapMarkers();
    }
  }, 300);
}

// ═══════════════════════════════════════════════════════════════
// 待定位操作函数
// ═══════════════════════════════════════════════════════════════
function pendingMapPick(photoId) {
  var photo = findPhotoById(photoId);
  if (!photo) return;
  S.pendingMapPickPhotoId = photoId;
  switchExtendedView('map');
  showToast && showToast('在地图上点一下目标位置');
  setTimeout(function () {
    if (typeof installMapPickHandler === 'function') installMapPickHandler();
  }, 600);
}

function pendingUseLastPhoto(photoId) {
  var photo = findPhotoById(photoId);
  if (!photo) return;

  var targetTime = photo.takenAt || photo.shootTime;
  var sorted = S.photos.filter(function (p) {
    return p.id !== photoId && isValidCoordinate(Number(p.lat), Number(p.lng));
  }).sort(function (a, b) {
    return new Date((b.takenAt || b.shootTime || '')).getTime() - new Date((a.takenAt || a.shootTime || '')).getTime();
  });

  if (sorted.length === 0) {
    showToast && showToast('没有已定位照片可供参考', 'warn');
    return;
  }

  var targetMs = targetTime ? new Date(targetTime).getTime() : Date.now();
  var closest = sorted[0];
  var minDiff = Infinity;
  sorted.forEach(function (p) {
    var t = p.takenAt || p.shootTime || p.importedAt || p.importTime;
    if (!t) return;
    var diff = Math.abs(new Date(t).getTime() - targetMs);
    if (diff < minDiff) { minDiff = diff; closest = p; }
  });

  if (!closest) return;

  var conf = 0.85, radius = 200;
  var diffMin = minDiff / 60000;
  if (diffMin <= 10) { conf = 0.85; radius = 200; }
  else if (diffMin <= 30) { conf = 0.70; radius = 500; }
  else if (diffMin <= 60) { conf = 0.55; radius = 1000; }
  else { conf = 0.40; radius = 2000; }

  photo.lat = Number(closest.lat);
  photo.lng = Number(closest.lng);
  photo.displayLat = closest.displayLat || closest.lat;
  photo.displayLng = closest.displayLng || closest.lng;
  photo.locationStatus = 'located';
  photo.locationSource = 'context_time';
  photo.confidence = conf;
  photo.accuracyRadius = radius;
  photo.hasLocation = true;
  photo.gpsSource = 'context_time';
  photo.gpsFailure = null;
  photo.gpsFailureMessage = null;
  if (!photo.inference) photo.inference = {};
  photo.inference.reason = '使用最近已定位照片的位置';
  photo.inference.basedOnPhotoIds = [closest.id];
  photo.inference.method = 'context_time';

  saveMetadataV2(S.photos);
  indexPhotos();
  renderPendingPanel();
  renderTimeline && renderTimeline('');
  updateStats && updateStats();
  if (S.map) { addMapMarkers && addMapMarkers(); fitMapBounds && fitMapBounds(); }
  showToast && showToast('已使用前一张照片的位置标记');
}

function pendingShowCandidates(photoId) {
  var photo = findPhotoById(photoId);
  if (!photo) return;

  if (typeof getLocationCandidatesForPhoto !== 'function') {
    showToast && showToast('推理引擎未加载', 'warn');
    return;
  }

  var result = getLocationCandidatesForPhoto(photo, S.photos);
  var candidates = result.context || [];

  if (candidates.length === 0) {
    showToast && showToast('暂无推荐位置（需要同一天有已定位照片）', 'warn');
    return;
  }

  showCandidateDialog(photo, candidates);
}

function pendingSkip(photoId) {
  showToast && showToast('已跳过');
}

// ═══════════════════════════════════════════════════════════════
// 推荐弹窗
// ═══════════════════════════════════════════════════════════════
function showCandidateDialog(photo, candidates) {
  var old = document.getElementById('candidate-dialog');
  if (old) old.remove();

  var items = candidates.slice(0, 3).map(function (c, i) {
    return '' +
      '<div class="candidate-item" data-ci="' + i + '">' +
        '<span style="font-size:1.2rem">📍</span>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-weight:500;margin-bottom:2px">' + c.reason + '</div>' +
          '<div style="font-size:0.65rem;color:var(--text3)">' +
            '坐标: ' + c.lat.toFixed(5) + ', ' + c.lng.toFixed(5) +
            ' · 精度: ~' + Math.round(c.accuracyRadius) + 'm' +
          '</div>' +
        '</div>' +
        '<span class="ci-conf">' + Math.round(c.confidence * 100) + '%</span>' +
      '</div>';
  }).join('');

  var html = '' +
    '<div id="candidate-dialog" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:3000;display:flex;align-items:flex-end;justify-content:center">' +
      '<div style="background:var(--bg);border:1px solid var(--glass-border);border-radius:var(--rl) var(--rl) 0 0;width:100%;max-width:420px;max-height:70vh;overflow-y:auto;padding:20px">' +
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">' +
          '<div style="font-weight:600;font-size:1rem">位置推荐</div>' +
          '<div style="font-size:0.72rem;color:var(--text3)">' + esc(photo.fileName) + '</div>' +
          '<button onclick="document.getElementById(\'candidate-dialog\').remove()" style="margin-left:auto;background:none;border:none;color:var(--text2);font-size:1.2rem;cursor:pointer">&times;</button>' +
        '</div>' +
        '<div class="candidate-list">' + items + '</div>' +
        '<div style="text-align:center;margin-top:12px">' +
          '<button onclick="document.getElementById(\'candidate-dialog\').remove()" style="padding:6px 20px;background:rgba(255,255,255,0.06);border:1px solid var(--border);color:var(--text2);border-radius:16px;cursor:pointer;font-size:0.78rem">取消</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML('beforeend', html);

  setTimeout(function () {
    document.querySelectorAll('.candidate-item').forEach(function (el) {
      el.addEventListener('click', function () {
        var idx = parseInt(this.dataset.ci);
        var candidate = candidates[idx];
        if (candidate && typeof confirmLocationCandidate === 'function') {
          confirmLocationCandidate(photo, candidate);
          if (typeof getDisplayForLocation === 'function') {
            getDisplayForLocation(photo.lat, photo.lng, photo.locationSource).then(function (d) {
              if (d) { photo.displayLat = d.lat; photo.displayLng = d.lng; }
              finalizeCandidateConfirm(photo);
            });
          } else {
            finalizeCandidateConfirm(photo);
          }
        }
        document.getElementById('candidate-dialog').remove();
      });
    });
  }, 100);
}

function finalizeCandidateConfirm(photo) {
  saveMetadataV2(S.photos);
  indexPhotos();
  renderPendingPanel();
  renderTimeline && renderTimeline('');
  updateStats && updateStats();
  if (S.map) { addMapMarkers && addMapMarkers(); fitMapBounds && fitMapBounds(); }
  showToast && showToast('已确认推荐位置');
}

// ═══════════════════════════════════════════════════════════════
// 辅助：按 ID 找照片
// ═══════════════════════════════════════════════════════════════
function findPhotoById(id) {
  if (!S.photos) return null;
  return S.photos.find(function (p) { return p.id === id; }) || null;
}

// ═══════════════════════════════════════════════════════════════
// 更新底部 Tab 的待定位角标
// ═══════════════════════════════════════════════════════════════
function updatePendingBadge() {
  var badge = document.getElementById('pending-badge');
  if (!badge || !S.photos) return;
  var pending = S.photos.filter(function (p) {
    return p.locationStatus === 'pending' || p.locationStatus === 'failed' ||
      (!p.hasLocation && (!p.lat || !p.lng));
  });
  badge.textContent = pending.length;
  badge.style.display = pending.length > 0 ? 'block' : 'none';
}

// ═══════════════════════════════════════════════════════════════
// 日期筛选器（地图 Tab）
// ═══════════════════════════════════════════════════════════════
function injectDateSelector() {
  var old = document.getElementById('date-selector-bar');
  if (old) old.remove();

  var dates = getDateList(S.photos);
  if (dates.length === 0) return;

  var html = '<div class="date-selector" id="date-selector-bar">' +
    '<button class="date-chip active" data-dk="all">全部</button>';

  dates.forEach(function (dk) {
    var count = 0;
    S.photos.forEach(function (p) {
      var t = p.takenAt || p.shootTime || p.importedAt || p.importTime;
      if (t && fmtFull(t).dateKey === dk) count++;
    });
    html += '<button class="date-chip" data-dk="' + dk + '">' + dk + ' (' + count + ')</button>';
  });

  html += '</div>';

  var mapView = document.getElementById('map-view');
  if (mapView) {
    mapView.insertAdjacentHTML('beforeend', html);
    document.querySelectorAll('#date-selector-bar .date-chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('#date-selector-bar .date-chip').forEach(function (c) {
          c.classList.remove('active');
        });
        this.classList.add('active');
        var dk = this.dataset.dk;
        filterMapByDate(dk);
      });
    });
  }
}

function filterMapByDate(dateKey) {
  S._mapDateFilter = dateKey === 'all' ? null : dateKey;

  if (!S.map) {
    initMap && initMap();
    return;
  }

  S.map.clearMap();
  if (S.cluster) { try { S.cluster.clearMarkers(); S.map.remove(S.cluster); } catch (e) { } S.cluster = null; }
  if (S._activeCircle) { try { S._activeCircle.setMap(null); } catch (e) {} S._activeCircle = null; }

  var filtered = S.photos.filter(function (p) {
    if (!isValidCoordinate(Number(p.lat), Number(p.lng))) return false;
    if (!S._mapDateFilter) return true;
    var t = p.takenAt || p.shootTime || p.importedAt || p.importTime;
    if (!t) return false;
    return fmtFull(t).dateKey === S._mapDateFilter;
  });

  if (S._dayRoute) { try { S._dayRoute.setMap(null); } catch (e) { } S._dayRoute = null; }
  var oldInfo = document.getElementById('day-route-info');
  if (oldInfo) oldInfo.remove();

  if (S._mapDateFilter) {
    var dayPhotos = getPhotosByDate(S.photos, S._mapDateFilter);
    drawDayRoute(dayPhotos);
  }

  addMapMarkersForPhotos(filtered);
  if (filtered.length > 0) fitMapBoundsForPhotos(filtered);
}

// ═══════════════════════════════════════════════════════════════
// 判断缩略图是否可用
// ═══════════════════════════════════════════════════════════════
function isUsableThumb(src) {
  return typeof src === 'string' && src.length > 100 && /^data:image\//i.test(src);
}

// ═══════════════════════════════════════════════════════════════
// 位置来源标签 + 颜色
// ═══════════════════════════════════════════════════════════════
function getSourceLabel(p) {
  var src = p.locationSource || p.gpsSource || 'unknown';
  if (src.indexOf('exif') >= 0 || src === 'js_exif_fallback' || src === 'android_exif_original') return 'EXIF';
  if (src.indexOf('manual') >= 0) return '手动';
  if (src === 'context_time') return '推理(时间)';
  if (src === 'context_place') return '推理(聚集)';
  if (src === 'ai_candidate') return 'AI候选';
  return '未知';
}

function getSourceColor(p) {
  var src = p.locationSource || p.gpsSource || '';
  if (src.indexOf('exif') >= 0) return '#22c55e';
  if (src.indexOf('manual') >= 0) return '#7c3aed';
  if (src.indexOf('context') >= 0) return '#00d4ff';
  return '#eab308';
}

function getStatusLabel(p) {
  if (p.locationStatus === 'located' || p.hasLocation) return '已定位';
  if (p.locationStatus === 'failed') return '读取失败';
  return '待定位';
}

// ═══════════════════════════════════════════════════════════════
// 构建 marker 弹窗 HTML（含完整定位元数据表格）
// ═══════════════════════════════════════════════════════════════
function buildMarkerPopupHTML(photos, lat, lng) {
  var first = photos[0];
  var useTime = first.takenAt || first.shootTime || first.importedAt || first.importTime;
  var dt = useTime ? fmtFull(useTime) : { dateKey: '?', day: '?' };
  var src = first.thumbnailData || first.imageData || '';
  var validSrc = isUsableThumb(src) ? src : '';
  var sourceLabel = getSourceLabel(first);
  var sourceColor = getSourceColor(first);
  var statusLabel = getStatusLabel(first);
  var conf = first.confidence !== undefined ? first.confidence : (first.hasLocation ? 1.0 : 0);
  var accRadius = first.accuracyRadius || 0;

  var html = '<div style="min-width:210px;max-width:310px;font-family:-apple-system,sans-serif;font-size:12px;line-height:1.7;color:#222;background:#fff;border-radius:10px;overflow:hidden">';

  if (validSrc) {
    html += '<img src="' + validSrc + '" ' +
      'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" ' +
      'style="width:100%;height:120px;object-fit:cover;display:block">' +
      '<div style="display:none;width:100%;height:100px;background:#f0f0f0;align-items:center;justify-content:center;font-size:2rem;color:#ccc">📷</div>';
  } else {
    html += '<div style="width:100%;height:80px;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:1.5rem;color:#ccc">📷 无缩略图</div>';
  }

  html += '<div style="padding:10px 12px">';
  html += '<div style="font-weight:700;font-size:13px;margin-bottom:2px">' + esc(first.fileName) + '</div>';
  html += '<div style="color:#666;font-size:11px;margin-bottom:6px">' + dt.dateKey + ' ' + (useTime ? fmtTime(useTime) : '') + '</div>';
  if (photos.length > 1) {
    html += '<div style="color:#999;font-size:10px;margin-bottom:4px">📍 此处共 ' + photos.length + ' 张照片</div>';
  }
  if (first.addressText || first.address) {
    html += '<div style="color:#555;font-size:11px;margin-bottom:4px">🏠 ' + esc(first.addressText || first.address || '') + '</div>';
  }

  html += '<div style="border-top:1px solid #eee;margin:6px 0"></div>';

  html += '<table style="width:100%;font-size:10px;border-collapse:collapse">';
  html += '<tr><td style="color:#999;padding:2px 4px;width:56px">纬度</td><td style="font-family:monospace;text-align:right">' + lat.toFixed(6) + '</td></tr>';
  html += '<tr><td style="color:#999;padding:2px 4px">经度</td><td style="font-family:monospace;text-align:right">' + lng.toFixed(6) + '</td></tr>';
  html += '<tr><td style="color:#999;padding:2px 4px">定位来源</td><td style="text-align:right;color:' + sourceColor + ';font-weight:600">' + sourceLabel + '</td></tr>';
  html += '<tr><td style="color:#999;padding:2px 4px">定位状态</td><td style="text-align:right">' + statusLabel + '</td></tr>';
  html += '<tr><td style="color:#999;padding:2px 4px">置信度</td><td style="text-align:right">' + Math.round(conf * 100) + '%</td></tr>';
  html += '<tr><td style="color:#999;padding:2px 4px">精度范围</td><td style="text-align:right">' + (accRadius > 0 ? '~' + Math.round(accRadius) + 'm' : '-') + '</td></tr>';
  html += '</table>';

  if (first.inference && first.inference.reason) {
    html += '<div style="margin-top:6px;padding:6px 8px;background:#f0f9ff;border-radius:6px;font-size:10px;color:#0284c7">💡 ' + esc(first.inference.reason) + '</div>';
  }

  html += '</div></div>';
  return html;
}

// ═══════════════════════════════════════════════════════════════
// 构建圆形缩略图 marker（替代默认图钉）
// ═══════════════════════════════════════════════════════════════
function buildCircularMarkerHTML(photo, size) {
  size = size || 44;
  var src = photo.thumbnailData || photo.imageData || '';
  var validSrc = isUsableThumb(src) ? src : '';
  var sourceColor = getSourceColor(photo);

  if (validSrc) {
    return '<div style="' +
      'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
      'overflow:hidden;border:3px solid ' + sourceColor + ';' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.35);background:#fff;' +
      'display:flex;align-items:center;justify-content:center;' +
      '">' +
      '<img src="' + validSrc + '" ' +
        'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'" ' +
        'style="width:100%;height:100%;object-fit:cover;display:block">' +
      '<span style="display:none;font-size:' + (size * 0.4) + 'px">📷</span>' +
      '</div>';
  } else {
    var initial = (photo.fileName || '?').charAt(0).toUpperCase();
    return '<div style="' +
      'width:' + size + 'px;height:' + size + 'px;border-radius:50%;' +
      'border:3px solid ' + sourceColor + ';' +
      'box-shadow:0 2px 8px rgba(0,0,0,0.35);' +
      'background:linear-gradient(135deg,' + sourceColor + '20,' + sourceColor + '10);' +
      'display:flex;align-items:center;justify-content:center;' +
      'font-size:' + (size * 0.35) + 'px;font-weight:700;color:' + sourceColor + ';' +
      '">' + initial + '</div>';
  }
}

// ═══════════════════════════════════════════════════════════════
// 增强版地图 Marker 渲染
// — 圆形缩略图 marker 替代默认图钉
// — 精度圈仅点击时显示（点击下一个时清除上一个）
// — 弹窗含完整定位元数据表格
// ═══════════════════════════════════════════════════════════════
function addMapMarkersForPhotos(photos) {
  if (!S.map || photos.length === 0) return;

  // 清除上一个精度圈
  if (S._activeCircle) {
    try { S._activeCircle.setMap(null); } catch (e) {}
    S._activeCircle = null;
  }

  var groups = {};
  photos.forEach(function (p) {
    var pt = getPhotoDisplayPoint(p);
    if (!pt) return;
    var k = pt.lat.toFixed(4) + ',' + pt.lng.toFixed(4);
    if (!groups[k]) groups[k] = [];
    groups[k].push(p);
  });

  var markers = [];
  Object.keys(groups).forEach(function (k) {
    var g = groups[k], ll = k.split(',').map(Number);
    var first = g[0];

    // 圆形缩略图 marker
    var markerHTML = buildCircularMarkerHTML(first, 44);
    var marker = new AMap.Marker({
      position: [ll[1], ll[0]],
      content: markerHTML,
      offset: new AMap.Pixel(-22, -22),
      zIndex: 100,
      title: first.fileName
    });
    marker._group = g;
    marker._locKey = k;
    marker._first = first;

    // 点击：弹窗 + 精度圈切换
    marker.on('click', function (e) {
      var clickedFirst = (this._group && this._group[0]) || this._first;
      if (!clickedFirst) return;
      var lat = ll[0], lng = ll[1];

      // 精度圈切换
      if (S._activeCircle) {
        try { S._activeCircle.setMap(null); } catch (e) {}
        S._activeCircle = null;
      }
      var accRadius = clickedFirst.accuracyRadius;
      if (accRadius && accRadius > 0) {
        try {
          S._activeCircle = new AMap.Circle({
            center: [lng, lat],
            radius: accRadius,
            strokeColor: 'rgba(0,212,255,0.5)',
            strokeWeight: 2,
            strokeStyle: 'dashed',
            fillColor: 'rgba(0,212,255,0.08)',
            zIndex: 50
          });
          S._activeCircle.setMap(S.map);
        } catch (e) {}
      }

      // 弹窗
      var popupHTML = buildMarkerPopupHTML(g, lat, lng);
      if (this._iw) {
        this._iw.setContent(popupHTML);
        this._iw.open(S.map, this.getPosition());
      } else {
        this._iw = new AMap.InfoWindow({
          content: popupHTML,
          offset: new AMap.Pixel(0, -30)
        });
        this._iw.open(S.map, this.getPosition());
      }
    });

    markers.push(marker);
  });

  // 添加到地图
  try {
    if (markers.length > 60 && typeof AMap.MarkerClusterer !== 'undefined') {
      S.cluster = new AMap.MarkerClusterer(S.map, markers, {
        gridSize: 80, maxZoom: 18, averageCenter: true,
        styles: [
          { url: '', size: { width: 40, height: 40 }, textColor: '#fff', textSize: 13, style: 'background:rgba(124,58,237,0.75);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;border:2px solid rgba(124,58,237,0.9)' },
          { url: '', size: { width: 48, height: 48 }, textColor: '#fff', textSize: 14, style: 'background:rgba(0,212,255,0.75);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;border:2px solid rgba(0,212,255,0.9)' },
          { url: '', size: { width: 56, height: 56 }, textColor: '#fff', textSize: 15, style: 'background:rgba(236,72,153,0.75);border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;border:2px solid rgba(236,72,153,0.9)' }
        ]
      });
    } else {
      markers.forEach(function (m) { S.map.add(m); });
    }
  } catch (e) {
    console.warn('MarkerClusterer error:', e);
    try { markers.forEach(function (m) { S.map.add(m); }); } catch (e2) {}
  }
}

function fitMapBoundsForPhotos(photos) {
  if (!S.map || photos.length === 0) return;
  if (photos.length === 1) {
    var pt = getPhotoDisplayPoint(photos[0]);
    S.map.setZoomAndCenter(14, [pt.lng, pt.lat]);
  } else {
    S.map.setFitView(null, false, [80, 80, 80, 80]);
  }
}

// ═══════════════════════════════════════════════════════════════
// 当天路线绘制
// ═══════════════════════════════════════════════════════════════
function drawDayRoute(dayPhotos) {
  if (!S.map) return;
  var route = getDayRoute(dayPhotos);
  if (!route || route.length < 2) return;

  if (S._dayRoute) { try { S._dayRoute.setMap(null); } catch (e) { } }

  var path = route.map(function (p) { return [p.lng, p.lat]; });

  try {
    S._dayRoute = new AMap.Polyline({
      path: path,
      strokeColor: 'rgba(0,212,255,0.6)',
      strokeWeight: 3,
      strokeStyle: 'dashed',
      zIndex: 60
    });
    S._dayRoute.setMap(S.map);
  } catch (e) {
    console.warn('路线绘制失败:', e);
  }

  var oldInfo = document.getElementById('day-route-info');
  if (oldInfo) oldInfo.remove();

  var infoHtml = '<div class="day-route-info" id="day-route-info">' +
    '<span style="color:var(--cyan)">🗺️ 当天路线</span> ' +
    route.length + ' 个定位点' +
    ' · ' + fmtTime(route[0].time) + ' → ' + fmtTime(route[route.length - 1].time) +
    '</div>';

  var mapView = document.getElementById('map-view');
  if (mapView) {
    mapView.insertAdjacentHTML('beforeend', infoHtml);
  }
}
