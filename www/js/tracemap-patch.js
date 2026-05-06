/**
 * 迹影地图 v3 — 运行时补丁
 * 在现有代码之后运行，增强核心函数，接入新模块
 * 不修改原始 index.html 的核心代码
 */

(function () {
  'use strict';

  var patchRetries = 0;
  var MAX_RETRIES = 50;

  function tryPatch() {
    if (typeof S === 'undefined' || typeof S.photos === 'undefined') {
      patchRetries++;
      if (patchRetries < MAX_RETRIES) setTimeout(tryPatch, 200);
      return;
    }
    applyPatches();
    runPostInit();
  }

  function applyPatches() {
    console.log('[迹影地图 v3] 应用运行时补丁...');

    // 补丁 1: 增强 saveMetadata，同时写 V2 格式
    var _saveMetadata = window.saveMetadata;
    if (typeof _saveMetadata === 'function') {
      window.saveMetadata = function (photos) {
        _saveMetadata(photos);
        if (typeof saveMetadataV2 === 'function') {
          try { saveMetadataV2(photos); } catch (e) { console.warn('V2 save failed:', e); }
        }
      };
    }

    // 补丁 2: 增强 processImport 中 EXIF 数据存储
    var _processImport = window.processImport;
    if (typeof _processImport === 'function') {
      window.processImport = async function (input) {
        var result = await _processImport(input);
        if (S.photos) {
          S.photos.forEach(function (p) {
            if (!p.exifRaw && (p.cameraMake || p.cameraModel || p.shootTime || p.hasLocation)) {
              p.exifRaw = {
                make: p.cameraMake || null,
                model: p.cameraModel || null,
                dateTimeOriginal: p.shootTime || null,
                gpsLatitude: p.hasLocation ? p.lat : null,
                gpsLongitude: p.hasLocation ? p.lng : null,
                gpsAltitude: p.altitude || null
              };
            }
            if (!p.locationStatus) {
              p.locationStatus = p.hasLocation ? 'located' : (p.gpsFailure ? 'failed' : 'pending');
            }
            if (!p.locationSource) {
              p.locationSource = p.hasLocation ? (p.gpsSource || 'exif') : 'unknown';
            }
            if (p.confidence === undefined) p.confidence = p.hasLocation ? 1.0 : 0;
            if (p.accuracyRadius === undefined && p.hasLocation) p.accuracyRadius = 30;
            if (!p.mimeType) p.mimeType = 'image/jpeg';
            if (!p.takenAt && p.shootTime) p.takenAt = p.shootTime;
            if (!p.importedAt && p.importTime) p.importedAt = p.importTime;
          });
          if (typeof saveMetadataV2 === 'function') {
            try { saveMetadataV2(S.photos); } catch (e) {}
          }
        }
        return result;
      };
    }

    // 补丁 4: 增强 switchView，支持底部 Tab
    var _switchView = window.switchView;
    if (typeof _switchView === 'function') {
      window.switchView = function (v) {
        if (v === 'pending' || v === 'places' || v === 'export') {
          if (typeof switchExtendedView === 'function') {
            switchExtendedView(v);
          }
          return;
        }
        _switchView(v);
        document.querySelectorAll('.btab').forEach(function (t) {
          t.classList.toggle('active', t.dataset.bview === v);
        });
      };
    }

    // 补丁 5: 增强 updateStats，更新待定位角标
    var _updateStats = window.updateStats;
    if (typeof _updateStats === 'function') {
      window.updateStats = function () {
        _updateStats();
        if (typeof updatePendingBadge === 'function') updatePendingBadge();
      };
    }

    // 补丁 6: 增强 installMapPickHandler，支持 pending 模式
    var _installMapPickHandler = window.installMapPickHandler;
    if (typeof _installMapPickHandler === 'function') {
      window.installMapPickHandler = function () {
        var pid = S.pendingMapPickPhotoId;
        if (pid) S._mapPickFromPending = true;
        _installMapPickHandler();
        if (S._mapPickFromPending) {
          var checkInterval = setInterval(function () {
            if (!S.pendingMapPickPhotoId) {
              clearInterval(checkInterval);
              S._mapPickFromPending = false;
              if (typeof renderPendingPanel === 'function') renderPendingPanel();
              if (typeof updatePendingBadge === 'function') updatePendingBadge();
            }
          }, 500);
          setTimeout(function () { clearInterval(checkInterval); }, 30000);
        }
      };
    }

    // 补丁 7: 增强 openModal，显示更多定位信息
    var _openModal = window.openModal;
    if (typeof _openModal === 'function') {
      window.openModal = function (idx) {
        _openModal(idx);
        var p = S.photos[idx];
        if (!p || !D.modalLocStatus) return;
        var statusHtml = [];
        if (p.locationSource === 'exif') {
          statusHtml.push('<span class="loc-badge exif">来源: EXIF</span>');
        } else if (p.locationSource === 'manual') {
          statusHtml.push('<span class="loc-badge manual">来源: 手动标记</span>');
        } else if (p.locationSource === 'context_time') {
          statusHtml.push('<span class="loc-badge context">来源: 上下文推理</span>');
        } else if (!p.hasLocation) {
          statusHtml.push('<span class="loc-badge pending">待定位</span>');
        }
        if (p.confidence !== undefined && p.confidence < 1.0) {
          statusHtml.push(' 置信度: ' + Math.round(p.confidence * 100) + '%');
        }
        if (p.accuracyRadius) {
          statusHtml.push(' 精度: ~' + Math.round(p.accuracyRadius) + 'm');
        }
        if (p.inference && p.inference.reason) {
          statusHtml.push('<br><span style="font-size:0.68rem;color:var(--text3)">' + esc(p.inference.reason) + '</span>');
        }
        D.modalLocStatus.innerHTML = statusHtml.join(' ') || D.modalLocStatus.textContent;
      };
    }

    // 补丁 8: 增强地图 addMapMarkers — 含清除旧数据 + accuracy circles + 圆形 marker
    var _addMapMarkers = window.addMapMarkers;
    if (typeof _addMapMarkers === 'function') {
      window.addMapMarkers = function (q) {
        // 清除旧标记
        if (S.map) S.map.clearMap();
        if (S.cluster) { try { S.cluster.clearMarkers(); S.map.remove(S.cluster); } catch (e) {} S.cluster = null; }
        if (S._accuracyCircles) {
          S._accuracyCircles.forEach(function (c) { try { c.setMap(null); } catch (e) {} });
          S._accuracyCircles = [];
        }
        if (S._dayRoute) { try { S._dayRoute.setMap(null); } catch (e) { } S._dayRoute = null; }
        if (S._activeCircle) { try { S._activeCircle.setMap(null); } catch (e) {} S._activeCircle = null; }

        if (S._mapDateFilter) {
          var filtered = S.photos.filter(function (p) {
            if (!isValidCoordinate(Number(p.lat), Number(p.lng))) return false;
            var t = p.takenAt || p.shootTime || p.importedAt || p.importTime;
            if (!t) return false;
            return fmtFull(t).dateKey === S._mapDateFilter;
          });
          if (typeof addMapMarkersForPhotos === 'function') {
            addMapMarkersForPhotos(filtered);
          }
        } else {
          var photos = S.photos.filter(function (p) {
            return p.hasLocation && typeof getPhotoDisplayPoint === 'function' && getPhotoDisplayPoint(p);
          });
          if (q && q.trim()) {
            var ql = q.toLowerCase();
            photos = photos.filter(function (p) {
              return p.fileName.toLowerCase().indexOf(ql) >= 0 ||
                (p.note && p.note.toLowerCase().indexOf(ql) >= 0) ||
                (p.addressText && p.addressText.toLowerCase().indexOf(ql) >= 0) ||
                (p.address && p.address.toLowerCase().indexOf(ql) >= 0);
            });
          }
          if (typeof addMapMarkersForPhotos === 'function') {
            addMapMarkersForPhotos(photos);
          }
        }
        if (typeof updateMapDebug === 'function') updateMapDebug();
      };
    }

    // 补丁 9: 增强 getDisplayPoint，同时检查新旧坐标
    var _getDisplayPoint = window.getDisplayPoint;
    if (typeof _getDisplayPoint === 'function' && typeof getPhotoDisplayPoint === 'function') {
      window.getDisplayPoint = function (p) {
        var pt = _getDisplayPoint(p);
        if (pt) return pt;
        return getPhotoDisplayPoint(p);
      };
    }

    console.log('[迹影地图 v3] 运行时补丁应用完成');
  }

  // ═══════════════════════════════════════════════════════════════
  // 启动后初始化（直接执行，不再依赖 initApp 包装器）
  // 因为 initApp() 在 patch 加载前已执行完毕
  // ═══════════════════════════════════════════════════════════════
  function runPostInit() {
    console.log('[迹影地图 v3] 执行启动后初始化...');

    // 1. 数据迁移：旧格式 → 新格式
    if (typeof migratePhotoToNewFormat === 'function' && S.photos) {
      var needsMigration = S.photos.some(function (p) {
        return !p.locationStatus || !p.locationSource || p.confidence === undefined;
      });
      if (needsMigration) {
        console.log('[迹影地图 v3] 开始数据迁移...');
        var migrated = S.photos.map(function (p) {
          return migratePhotoToNewFormat(p);
        }).filter(Boolean);
        S.photos = migrated;
        if (typeof indexPhotos === 'function') indexPhotos();
        if (typeof renderTimeline === 'function') renderTimeline('');
        if (typeof updateStats === 'function') updateStats();
        if (typeof saveMetadataV2 === 'function') saveMetadataV2(S.photos);
        console.log('[迹影地图 v3] 数据迁移完成: ' + S.photos.length + ' 张');
      }
    }

    // 2. 确保所有照片有默认新字段
    if (S.photos) {
      S.photos.forEach(function (p) {
        if (!p.locationStatus) p.locationStatus = p.hasLocation ? 'located' : 'pending';
        if (!p.locationSource) p.locationSource = p.hasLocation ? (p.gpsSource || 'exif') : 'unknown';
        if (p.confidence === undefined) p.confidence = p.hasLocation ? 1.0 : 0;
        if (p.accuracyRadius === undefined && p.hasLocation) p.accuracyRadius = 30;
        if (!p.mimeType) p.mimeType = 'image/jpeg';
        if (!p.takenAt && p.shootTime) p.takenAt = p.shootTime;
        if (!p.importedAt && p.importTime) p.importedAt = p.importTime;
      });
    }

    // 3. 初始化扩展 UI（底部 Tab、面板、样式）
    if (typeof initExtendedUI === 'function') {
      try {
        initExtendedUI();
        console.log('[迹影地图 v3] 扩展 UI 已初始化');
      } catch (e) {
        console.warn('[迹影地图 v3] 扩展 UI 初始化失败:', e);
      }
    }

    // 4. 注入日期筛选器
    if (typeof injectDateSelector === 'function') {
      try { injectDateSelector(); } catch (e) { console.warn('日期筛选器注入失败:', e); }
    }

    // 5. 更新待定位角标
    if (typeof updatePendingBadge === 'function') {
      try { updatePendingBadge(); } catch (e) {}
    }

    // 6. 隐藏旧顶部 tabs、缩小 header（injectEnhancedStyles 中也会用 setTimeout 处理）
    //    这里再保底执行一次
    try {
      var oldTabs = document.querySelector('.view-tabs');
      if (oldTabs) oldTabs.style.display = 'none';
      var header = document.getElementById('header');
      if (header) {
        header.style.paddingTop = 'max(env(safe-area-inset-top), 8px)';
        header.style.paddingBottom = '6px';
        if (!header.classList.contains('compact')) header.classList.add('compact');
      }
    } catch (e) {}

    console.log('[迹影地图 v3] 启动后初始化完成');
  }

  setTimeout(tryPatch, 500);
})();
