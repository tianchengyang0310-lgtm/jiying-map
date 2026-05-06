# 迹影地图

**融合 EXIF 解析与上下文推理的本地照片地理日记系统**

将照片导入浏览器，自动读取 GPS 位置标注在地图上。没有 GPS 的照片进入「待定位」列表，系统根据同一天相邻照片的时间关系智能推荐位置，用户确认后即可补全地理信息。

---

## 核心功能

- **本地照片导入** — 从手机相册批量导入，所有数据保存在浏览器本地
- **EXIF GPS 自动读取** — 解析 JPEG 元数据，自动提取经纬度、拍摄时间、相机型号、海拔高度
- **地图自动打点** — 有 GPS 的照片自动标注在高德地图上，含精度范围圈
- **缺失 GPS 待定位** — 无位置信息的照片自动进入「待定位」列表，说明可能原因
- **手动地图选点** — 在地图上直接点击补全位置
- **上下文位置推荐** — 根据同一天相邻照片的时间差推荐可能位置
  - ≤10 分钟相邻照片：置信度 85%，精度 200m
  - ≤30 分钟相邻照片：置信度 70%，精度 500m
  - 同天聚集区域推荐：置信度 60%
- **日期筛选与路线回放** — 选择某一天，地图显示当天照片并按时间连线
- **记忆地点聚类** — 500m 半径内照片自动归为「记忆地点」，显示照片数量和时间范围
- **CSV / GeoJSON 导出** — 导出有位置照片为 GIS 标准格式，可直接导入 QGIS/ArcGIS
- **底部 Tab 导航** — 照片 / 地图 / 待定位 / 地点 / 导出 五大面板
- **本地优先、隐私优先** — 所有照片和位置数据默认保存在 IndexedDB + localStorage，不上传服务器

## 技术特点

- **Capacitor 6** + 原生 JavaScript 单页应用
- **高德地图 JS API 2.0** — Marker 聚合、逆地理编码、路线绘制
- **IndexedDB** 存储照片 Base64（原图 + 缩略图）
- **localStorage** 存储 V2 元数据（含定位状态、置信度、推理来源）
- **自定义 EXIF 解析器** — 二进制 DataView 直接解析，支持 GPS DMS/分数格式、高度
- **Haversine 距离计算** — 地点聚类和精度范围
- **时间邻近上下文推理** — 轻量级纯前端算法，无需 AI 依赖
- **AI 候选接口预留** — 为后续接入 GeoAgent (CVPR 2026) / GeoSeek 等模型做好准备
- **GIS 数据导出** — GeoJSON FeatureCollection、CSV 含完整字段

## 项目结构

```
www/
├── index.html          # 主应用（HTML + CSS + 核心 JS）
├── js/
│   ├── tracemap-data.js      # 数据结构、IndexedDB 增强、EXIF 工具
│   ├── tracemap-inference.js # 上下文位置推理引擎
│   ├── tracemap-export.js    # CSV / GeoJSON 导出
│   ├── tracemap-places.js    # 记忆地点聚类
│   ├── tracemap-ui.js        # 底部 Tab、面板、扩展 UI
│   └── tracemap-patch.js     # 运行时补丁（非侵入式增强）
├── capacitor.config.json
└── package.json
```

## 使用说明

1. 手机浏览器打开 `www/index.html`（或构建为 APK）
2. 点击「导入照片」从相册批量选择
3. 有 GPS 的照片自动出现在地图上
4. 无 GPS 照片进入「待定位」Tab
5. 点击待定位照片，可「地图选点」「用前一张位置」「查看推荐」
6. 在地图 Tab 选择日期，查看当天路线
7. 导出 Tab 下载 GeoJSON / CSV

## AI 候选接口

当前已预留 `inferLocationByAI(photo)` 函数。未来可接入：

1. **GeoAgent** (CVPR 2026) — 多模态图像地理定位模型
2. **GeoSeek** 数据集 — 公开标注数据集 (Hugging Face: ghost2)
3. 本地 Ollama + 多模态模型
4. 远程 API 调用
5. 浏览器端 ONNX/WebGPU 推理

接口定义见 `www/js/tracemap-inference.js` 末尾。

## 开发

```bash
cd app
npm install
# 浏览器开发：直接用 Live Server 打开 www/
# Android 构建
npx cap add android
npx cap sync
npx cap open android
```

## 许可

个人使用项目。所有数据完全本地存储，隐私优先。
