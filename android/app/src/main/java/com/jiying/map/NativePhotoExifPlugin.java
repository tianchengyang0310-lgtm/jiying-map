package com.jiying.map;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.provider.MediaStore;
import android.util.Log;
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.ActivityResultRegistryOwner;
import androidx.activity.result.PickVisualMediaRequest;
import androidx.activity.result.contract.ActivityResultContract;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.exifinterface.media.ExifInterface;

import com.getcapacitor.FileUtils;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

@CapacitorPlugin(
    name = "NativePhotoExif",
    permissions = {
        @Permission(
            alias = "mediaLocation",
            strings = { Manifest.permission.ACCESS_MEDIA_LOCATION }
        )
    }
)
public class NativePhotoExifPlugin extends Plugin {
    private static final String TAG = "TraceMapGPS";
    private static final String SOURCE = "android_exif_original";
    private final AtomicInteger nextRequestCode = new AtomicInteger();
    private ActivityResultLauncher<PickVisualMediaRequest> pickMediaLauncher;

    // ── Plugin methods ─────────────────────────────────────────────

    @PluginMethod
    public void getLocationFromUri(PluginCall call) {
        String uriString = call.getString("uri");
        Log.d(TAG, "[getLocationFromUri] called with uri: " + (uriString != null ? uriString.substring(0, Math.min(uriString.length(), 200)) : "null"));

        if (uriString == null || uriString.trim().isEmpty()) {
            Log.w(TAG, "[getLocationFromUri] FAIL: NO_URI — empty or null uri");
            resolveFailure(call, "NO_URI", "Missing uri");
            return;
        }

        // Check permission for content:// URIs
        if (needsMediaLocationPermission()) {
            Log.d(TAG, "[getLocationFromUri] ACCESS_MEDIA_LOCATION not granted, requesting...");
            requestPermissionForAlias("mediaLocation", call, "readLocationPermsCallback");
            return;
        }

        readLocation(call);
    }

    @PluginMethod
    public void pickImagesWithLocation(PluginCall call) {
        Log.d(TAG, "[pickImagesWithLocation] called, limit=" + call.getInt("limit", 50));
        // Now delegates to pickImagesFromMediaStore as the primary path
        pickImagesFromMediaStore(call);
    }

    /**
     * NEW: Primary picker using ACTION_OPEN_DOCUMENT to get real MediaStore URIs.
     * This preserves full EXIF including GPS, unlike the Android Photo Picker
     * (PickVisualMedia) which strips GPS from the image stream.
     */
    @PluginMethod
    public void pickImagesFromMediaStore(PluginCall call) {
        int limit = Math.max(1, Math.min(call.getInt("limit", 50), 100));
        Log.d(TAG, "[pickImagesFromMediaStore] called, limit=" + limit
            + " — using ACTION_OPEN_DOCUMENT (MediaStore original image path)");

        if (needsMediaLocationPermission()) {
            Log.d(TAG, "[pickImagesFromMediaStore] ACCESS_MEDIA_LOCATION not granted on Android " + Build.VERSION.SDK_INT + ", requesting...");
            requestPermissionForAlias("mediaLocation", call, "pickImagesPermsCallback");
            return;
        }

        Log.d(TAG, "[pickImagesFromMediaStore] ACCESS_MEDIA_LOCATION granted, opening ACTION_OPEN_DOCUMENT picker");
        openDocumentPicker(call, limit);
    }

    @PermissionCallback
    private void readLocationPermsCallback(PluginCall call) {
        PermissionState state = getPermissionState("mediaLocation");
        Log.d(TAG, "[readLocationPermsCallback] permission state: " + state);

        if (needsMediaLocationPermission()) {
            Log.w(TAG, "[readLocationPermsCallback] FAIL: NO_PERMISSION — ACCESS_MEDIA_LOCATION denied");
            resolveFailure(call, "NO_PERMISSION", "ACCESS_MEDIA_LOCATION denied by user");
            return;
        }
        Log.d(TAG, "[readLocationPermsCallback] permission granted, proceeding to readLocation");
        readLocation(call);
    }

    @PermissionCallback
    private void pickImagesPermsCallback(PluginCall call) {
        PermissionState state = getPermissionState("mediaLocation");
        Log.d(TAG, "[pickImagesPermsCallback] permission state: " + state);

        if (needsMediaLocationPermission()) {
            Log.w(TAG, "[pickImagesPermsCallback] FAIL: NO_PERMISSION — returning empty photos with reason");
            JSObject ret = new JSObject();
            ret.put("photos", new JSArray());
            ret.put("success", false);
            ret.put("reason", "NO_PERMISSION");
            ret.put("message", "ACCESS_MEDIA_LOCATION denied — 请在系统设置中授予'访问媒体位置信息'权限");
            call.resolve(ret);
            return;
        }
        Log.d(TAG, "[pickImagesPermsCallback] permission granted, opening picker — using ACTION_OPEN_DOCUMENT (MediaStore)");
        openOriginalImagePicker(call);
    }

    private boolean needsMediaLocationPermission() {
        boolean needed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && getPermissionState("mediaLocation") != PermissionState.GRANTED;
        Log.d(TAG, "[needsMediaLocationPermission] SDK=" + Build.VERSION.SDK_INT + ", state=" + getPermissionState("mediaLocation") + ", needed=" + needed);
        return needed;
    }

    private void openOriginalImagePicker(PluginCall call) {
        int limit = Math.max(1, Math.min(call.getInt("limit", 50), 100));
        // PRIMARY PATH: ACTION_OPEN_DOCUMENT → real MediaStore URIs → full GPS EXIF
        // FALLBACK: PickVisualMedia (Android Photo Picker) — strips GPS but works as last resort
        try {
            Log.d(TAG, "[openOriginalImagePicker] PRIMARY: trying ACTION_OPEN_DOCUMENT (MediaStore original path), limit=" + limit);
            openDocumentPicker(call, limit);
        } catch (Exception e) {
            Log.w(TAG, "[openOriginalImagePicker] ACTION_OPEN_DOCUMENT failed: " + e.getMessage() + ", FALLBACK: trying PickVisualMedia");
            try {
                openPhotoPicker(call, limit);
            } catch (Exception e2) {
                Log.e(TAG, "[openOriginalImagePicker] ALL pickers failed: " + e2.getMessage());
                JSObject ret = new JSObject();
                ret.put("photos", new JSArray());
                ret.put("success", false);
                ret.put("reason", "PICKER_FAILED");
                ret.put("message", "无法打开图片选择器: " + e2.getMessage());
                call.resolve(ret);
            }
        }
    }

    private void openPhotoPicker(final PluginCall call, final int limit) {
        if (pickMediaLauncher != null) {
            try {
                pickMediaLauncher.unregister();
            } catch (Exception ignored) {}
            pickMediaLauncher = null;
        }

        ActivityResultContract<PickVisualMediaRequest, List<Uri>> contract =
            limit > 1
                ? new ActivityResultContracts.PickMultipleVisualMedia(limit)
                : new ActivityResultContracts.PickMultipleVisualMedia();

        pickMediaLauncher = registerActivityResultLauncher(contract, uris -> {
            Log.d(TAG, "[photoPicker] result returned, uris=" + (uris != null ? uris.size() : 0));
            JSObject ret = new JSObject();
            JSArray photos = new JSArray();
            ret.put("photos", photos);

            if (uris == null || uris.isEmpty()) {
                Log.d(TAG, "[photoPicker] no URIs selected (cancelled or empty)");
                ret.put("success", true);
                call.resolve(ret);
                return;
            }

            int count = Math.min(uris.size(), limit);
            Log.d(TAG, "[photoPicker] processing " + count + " URIs");
            for (int i = 0; i < count; i++) {
                Uri uri = uris.get(i);
                Log.d(TAG, "[photoPicker] URI[" + i + "]: " + uri.toString() + " scheme=" + uri.getScheme());
                photos.put(buildPickedPhoto(uri, i));
            }
            ret.put("success", true);
            call.resolve(ret);
        });

        pickMediaLauncher.launch(
            new PickVisualMediaRequest.Builder()
                .setMediaType(ActivityResultContracts.PickVisualMedia.ImageOnly.INSTANCE)
                .build()
        );
    }

    private <I, O> ActivityResultLauncher<I> registerActivityResultLauncher(
        ActivityResultContract<I, O> contract,
        ActivityResultCallback<O> callback
    ) {
        String key = "native_photo_exif#" + nextRequestCode.getAndIncrement();
        if (bridge.getFragment() != null) {
            Object host = bridge.getFragment().getHost();
            if (host instanceof ActivityResultRegistryOwner) {
                return ((ActivityResultRegistryOwner) host).getActivityResultRegistry().register(key, contract, callback);
            }
            return bridge.getFragment().requireActivity().getActivityResultRegistry().register(key, contract, callback);
        }
        return bridge.getActivity().getActivityResultRegistry().register(key, contract, callback);
    }

    private void openDocumentPicker(PluginCall call, int limit) {
        Log.d(TAG, "[openDocumentPicker] opening ACTION_OPEN_DOCUMENT picker (MediaStore URI path — preserves GPS EXIF), limit=" + limit);
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, limit > 1);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

        startActivityForResult(call, intent, "pickImagesResult");
    }

    @ActivityCallback
    private void pickImagesResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        Log.d(TAG, "[pickImagesResult] resultCode=" + result.getResultCode());
        JSObject ret = new JSObject();
        JSArray photos = new JSArray();
        ret.put("photos", photos);

        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            Log.d(TAG, "[pickImagesResult] user cancelled");
            ret.put("success", true);
            call.resolve(ret);
            return;
        }

        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            Log.w(TAG, "[pickImagesResult] FAIL: no picker result data");
            ret.put("success", false);
            ret.put("reason", "READ_FAILED");
            ret.put("message", "No picker result");
            call.resolve(ret);
            return;
        }

        int limit = Math.max(1, Math.min(call.getInt("limit", 50), 100));
        List<Uri> uris = collectUris(data, limit);
        Log.d(TAG, "[pickImagesResult] collected " + uris.size() + " URIs from ACTION_OPEN_DOCUMENT picker");
        for (int i = 0; i < uris.size(); i++) {
            Uri uri = uris.get(i);
            String uriType = uri.toString().contains("content://media/external/") ? "MediaStore"
                : uri.toString().contains("content://com.android.providers.media.documents/") ? "DocumentsProvider"
                : "unknown";
            Log.d(TAG, "[pickImagesResult] URI[" + i + "]: " + uri.toString() + " type=" + uriType);
            persistReadPermission(uri, data.getFlags());
            photos.put(buildPickedPhoto(uri, i));
        }

        ret.put("success", true);
        call.resolve(ret);
    }

    private List<Uri> collectUris(Intent data, int limit) {
        ArrayList<Uri> uris = new ArrayList<>();
        ClipData clipData = data.getClipData();
        if (clipData != null) {
            int count = Math.min(clipData.getItemCount(), limit);
            for (int i = 0; i < count; i++) {
                Uri uri = clipData.getItemAt(i).getUri();
                if (uri != null) uris.add(uri);
            }
        } else if (data.getData() != null) {
            uris.add(data.getData());
        }
        return uris;
    }

    private void persistReadPermission(Uri uri, int flags) {
        try {
            int takeFlags = flags & Intent.FLAG_GRANT_READ_URI_PERMISSION;
            if (takeFlags != 0) {
                getContext().getContentResolver().takePersistableUriPermission(uri, takeFlags);
            }
        } catch (Exception ignored) {}
    }

    private JSObject buildPickedPhoto(Uri originalUri, int index) {
        Log.d(TAG, "[buildPickedPhoto] index=" + index + " uri=" + originalUri.toString());
        JSObject ret = new JSObject();
        ret.put("uri", originalUri.toString());
        ret.put("sourceUri", originalUri.toString());
        ret.put("originalUri", originalUri.toString());

        JSObject gpsResult = readLocationForUri(originalUri);
        ret.put("nativeLocation", gpsResult);
        Log.d(TAG, "[buildPickedPhoto] GPS result: success=" + gpsResult.optBoolean("success", false)
            + " reason=" + gpsResult.optString("reason", "none")
            + " lat=" + gpsResult.optDouble("lat", Double.NaN)
            + " lng=" + gpsResult.optDouble("lng", Double.NaN)
            + " takenAt=" + gpsResult.optString("takenAt", "none"));

        // Pass through EXIF metadata to top level for easy frontend access
        if (gpsResult.has("takenAt")) ret.put("takenAt", gpsResult.optString("takenAt", null));
        if (gpsResult.has("make")) ret.put("make", gpsResult.optString("make", null));
        if (gpsResult.has("model")) ret.put("model", gpsResult.optString("model", null));

        try {
            Uri cacheUri = copyUriToCache(originalUri, index);
            ret.put("path", cacheUri.toString());
            ret.put("webPath", FileUtils.getPortablePath(getContext(), bridge.getLocalUrl(), cacheUri));
            ret.put("name", new File(cacheUri.getPath()).getName());
            Log.d(TAG, "[buildPickedPhoto] cached to: " + cacheUri + " webPath=" + ret.optString("webPath", ""));
        } catch (Exception e) {
            Log.w(TAG, "[buildPickedPhoto] COPY_FAILED: " + e.getMessage());
            ret.put("error", "COPY_FAILED");
            ret.put("message", e.getMessage());
        }

        return ret;
    }

    // ── GPS Location Reading ────────────────────────────────────────

    private void readLocation(PluginCall call) {
        String uriString = call.getString("uri");
        Log.d(TAG, "[readLocation] uri: " + (uriString != null ? uriString.substring(0, Math.min(uriString.length(), 200)) : "null"));

        if (uriString == null || uriString.trim().isEmpty()) {
            resolveFailure(call, "NO_URI", "Missing uri");
            return;
        }

        Uri uri;
        try {
            uri = Uri.parse(uriString);
        } catch (Exception e) {
            Log.w(TAG, "[readLocation] INVALID_URI parse error: " + e.getMessage());
            resolveFailure(call, "INVALID_URI", e.getMessage());
            return;
        }

        String scheme = uri.getScheme();
        Log.d(TAG, "[readLocation] scheme=" + scheme + " path=" + (uri.getPath() != null ? uri.getPath().substring(0, Math.min(uri.getPath().length(), 200)) : "null"));

        JSObject result = readLocationForUri(uri);
        Log.d(TAG, "[readLocation] result: success=" + result.optBoolean("success", false)
            + " reason=" + result.optString("reason", "none"));
        call.resolve(result);
    }

    /**
     * Read GPS location from a URI. Handles:
     * - content:// URIs (MediaStore, via setRequireOriginal on Android 10+)
     * - file:// URIs (direct filesystem access via ExifInterface file path constructor)
     * - Raw paths without scheme (treated as file paths)
     * - http://localhost URIs (cannot read — returns WEBVIEW_URI failure)
     */
    private JSObject readLocationForUri(Uri uri) {
        if (uri == null) {
            return failureObject("NO_URI", "Missing uri");
        }

        String scheme = uri.getScheme();
        Log.d(TAG, "[readLocationForUri] scheme=" + scheme + " uri=" + uri.toString().substring(0, Math.min(uri.toString().length(), 200)));

        // ── Case 1: http/https — WebView localhost URI, cannot read ──
        if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
            Log.w(TAG, "[readLocationForUri] FAIL: WEBVIEW_URI — cannot read http(s) URIs via ExifInterface");
            return failureObject("WEBVIEW_URI", "WebView无法读取该URI，请使用content://或file://路径");
        }

        // ── Case 2: file:// or no scheme → try direct file access ──
        if ("file".equalsIgnoreCase(scheme) || scheme == null || scheme.isEmpty()) {
            String filePath = (scheme != null && scheme.length() > 0) ? uri.getPath() : uri.toString();
            Log.d(TAG, "[readLocationForUri] treating as file path: " + (filePath != null ? filePath.substring(0, Math.min(filePath.length(), 200)) : "null"));

            File file = new File(filePath);
            if (!file.exists()) {
                Log.w(TAG, "[readLocationForUri] FAIL: FILE_NOT_FOUND — file does not exist: " + filePath);
                return failureObject("FILE_NOT_FOUND", "文件不存在: " + filePath);
            }
            if (!file.canRead()) {
                Log.w(TAG, "[readLocationForUri] FAIL: FILE_NOT_READABLE — cannot read file: " + filePath);
                return failureObject("FILE_NOT_READABLE", "文件不可读: " + filePath);
            }

            try {
                Log.d(TAG, "[readLocationForUri] reading ExifInterface from file: " + filePath + " size=" + file.length());
                ExifInterface exif = new ExifInterface(file);
                JSObject result = extractGpsFromExif(exif, "android_exif_file");
                enrichWithExifMetadata(result, exif);
                return result;
            } catch (Exception e) {
                Log.w(TAG, "[readLocationForUri] FAIL: READ_FAILED (file) — " + e.getClass().getSimpleName() + ": " + e.getMessage());
                return failureObject("READ_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage());
            }
        }

        // ── Case 3: content:// URI — use ContentResolver, optionally with setRequireOriginal ──
        String uriString = uri.toString();
        boolean isPickerUri = uriString.contains("media/picker/");
        Log.d(TAG, "[readLocationForUri] isPickerUri=" + isPickerUri + " (content://media/picker/ detected)");

        Uri readableUri = uri;
        boolean triedRequireOriginal = false;
        boolean requireOriginalDenied = false;
        String requireOriginalError = null;

        // setRequireOriginal is NOT supported for picker URIs (content://media/picker/...)
        // These are transient URIs from the Android Photo Picker that don't support
        // the requireOriginal query parameter at the ContentProvider level.
        if (!isPickerUri && Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && "content".equalsIgnoreCase(uri.getScheme())) {
            Log.d(TAG, "[readLocationForUri] Android 10+ non-picker URI, attempting MediaStore.setRequireOriginal");

            Uri mediaUri = toMediaStoreUriIfPossible(uri);
            Log.d(TAG, "[readLocationForUri] mediaUri: " + (mediaUri != null ? mediaUri.toString().substring(0, Math.min(mediaUri.toString().length(), 150)) : "null"));

            Uri modifiedUri = null;

            try {
                modifiedUri = MediaStore.setRequireOriginal(mediaUri);
                Log.d(TAG, "[readLocationForUri] setRequireOriginal(mediaUri) succeeded: " + (modifiedUri != null));
            } catch (SecurityException e) {
                Log.w(TAG, "[readLocationForUri] setRequireOriginal(mediaUri) SecurityException: " + e.getMessage());
                requireOriginalDenied = true;
                requireOriginalError = "SecurityException on mediaUri: " + e.getMessage();
            } catch (Exception e) {
                Log.w(TAG, "[readLocationForUri] setRequireOriginal(mediaUri) " + e.getClass().getSimpleName() + ": " + e.getMessage());
            }

            if (modifiedUri == null && !mediaUri.equals(uri)) {
                try {
                    modifiedUri = MediaStore.setRequireOriginal(uri);
                    Log.d(TAG, "[readLocationForUri] setRequireOriginal(uri) succeeded: " + (modifiedUri != null));
                } catch (SecurityException e) {
                    Log.w(TAG, "[readLocationForUri] setRequireOriginal(uri) SecurityException: " + e.getMessage());
                    requireOriginalDenied = true;
                    if (requireOriginalError == null) requireOriginalError = "SecurityException on uri: " + e.getMessage();
                } catch (Exception e) {
                    Log.w(TAG, "[readLocationForUri] setRequireOriginal(uri) " + e.getClass().getSimpleName() + ": " + e.getMessage());
                }
            }

            if (modifiedUri != null) {
                readableUri = modifiedUri;
                triedRequireOriginal = true;
                Log.d(TAG, "[readLocationForUri] using originalUri from setRequireOriginal");
            } else if (requireOriginalDenied) {
                Log.w(TAG, "[readLocationForUri] setRequireOriginal denied — will use regular content URI");
            }
        } else if (isPickerUri) {
            Log.d(TAG, "[readLocationForUri] skipping setRequireOriginal for picker URI — not supported by Photo Picker");
        }

        // Try ExifInterface via ContentResolver input stream
        JSObject result = readExifFromContentUri(readableUri, SOURCE);

        // If we used setRequireOriginal and it failed (typically UnsupportedOperationException
        // from picker URIs), retry with the original unmodified URI as fallback
        if (!result.getBoolean("success", false) && triedRequireOriginal && !readableUri.equals(uri)) {
            String failReason = result.optString("reason", "");
            Log.w(TAG, "[readLocationForUri] setRequireOriginal URI read failed (" + failReason
                + "), retrying with original URI as fallback");
            result = readExifFromContentUri(uri, SOURCE);
        }

        // If we still have no GPS, check if it's a permission issue
        if (!result.getBoolean("success", false) && requireOriginalDenied
            && "NO_GPS".equals(result.optString("reason", ""))) {
            Log.w(TAG, "[readLocationForUri] FAIL: NO_PERMISSION — setRequireOriginal denied, fallback had no GPS");
            return failureObject("NO_PERMISSION",
                requireOriginalError != null
                    ? "无ACCESS_MEDIA_LOCATION权限 (" + requireOriginalError + ")"
                    : "无ACCESS_MEDIA_LOCATION权限，请在系统设置中授予");
        }

        return result;
    }

    /**
     * Open a content:// URI via ContentResolver, create ExifInterface from the stream,
     * and extract GPS + metadata. Safe fallback — never throws, always returns a JSObject.
     */
    private JSObject readExifFromContentUri(Uri uri, String source) {
        Log.d(TAG, "[readExifFromContentUri] opening stream for: " + uri.toString().substring(0, Math.min(uri.toString().length(), 200)));

        try (InputStream stream = openStream(uri)) {
            if (stream == null) {
                Log.w(TAG, "[readExifFromContentUri] FAIL: NULL_STREAM — openStream returned null");
                return failureObject("NULL_STREAM", "无法打开数据流");
            }

            Log.d(TAG, "[readExifFromContentUri] creating ExifInterface from stream");
            ExifInterface exif;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                exif = new ExifInterface(stream);
            } else {
                // Fallback for API 22-23: copy to temp file and read from path
                Log.w(TAG, "[readExifFromContentUri] API " + Build.VERSION.SDK_INT + " < 24, using temp file fallback");
                File tmp = new File(getContext().getCacheDir(), "exif_tmp_" + System.currentTimeMillis() + ".jpg");
                try (FileOutputStream fos = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[8192]; int n;
                    while ((n = stream.read(buf)) != -1) fos.write(buf, 0, n);
                }
                exif = new ExifInterface(tmp.getAbsolutePath());
                tmp.delete();
            }

            JSObject result = extractGpsFromExif(exif, source);
            enrichWithExifMetadata(result, exif);

            if (result.getBoolean("success", false)) {
                Log.d(TAG, "[readExifFromContentUri] GPS FOUND from stream");
            } else {
                Log.d(TAG, "[readExifFromContentUri] No GPS in EXIF stream — reason=" + result.optString("reason", "none"));
            }
            return result;

        } catch (SecurityException e) {
            Log.w(TAG, "[readExifFromContentUri] FAIL: SECURITY_EXCEPTION — " + e.getMessage());
            return failureObject("NO_PERMISSION", "SecurityException: " + e.getMessage());
        } catch (Exception e) {
            Log.w(TAG, "[readExifFromContentUri] FAIL: READ_FAILED — " + e.getClass().getSimpleName() + ": " + e.getMessage());
            return failureObject("READ_FAILED", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    /**
     * Extract GPS coordinates from an ExifInterface instance.
     * Returns {success, lat, lng, source} or {success:false, reason, message}.
     */
    private JSObject extractGpsFromExif(ExifInterface exif, String source) {
        try {
            double[] latLong = exif.getLatLong();

            if (latLong != null && latLong.length >= 2 && isValidCoordinate(latLong[0], latLong[1])) {
                Log.d(TAG, "[extractGpsFromExif] GPS FOUND: lat=" + latLong[0] + " lng=" + latLong[1]);
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("lat", latLong[0]);
                ret.put("lng", latLong[1]);
                ret.put("source", source);
                return ret;
            }

            // Check individual tags for debugging
            String gpsLat = exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE);
            String gpsLatRef = exif.getAttribute(ExifInterface.TAG_GPS_LATITUDE_REF);
            String gpsLng = exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE);
            String gpsLngRef = exif.getAttribute(ExifInterface.TAG_GPS_LONGITUDE_REF);
            Log.d(TAG, "[extractGpsFromExif] No GPS. Tags: GPSLatitude=" + gpsLat
                + " GPSLatitudeRef=" + gpsLatRef
                + " GPSLongitude=" + gpsLng
                + " GPSLongitudeRef=" + gpsLngRef);

            JSObject ret = new JSObject();
            ret.put("success", false);
            ret.put("reason", "NO_GPS");
            ret.put("source", source);
            ret.put("message", "EXIF中无GPS位置信息"
                + (gpsLat != null ? " (GPSLatitude=" + gpsLat + ")" : "")
                + (gpsLat == null && gpsLng == null ? " — GPS标签不存在" : ""));
            return ret;
        } catch (Exception e) {
            Log.w(TAG, "[extractGpsFromExif] FAIL: " + e.getClass().getSimpleName() + ": " + e.getMessage());
            return failureObject("READ_FAILED", "ExifInterface解析失败: " + e.getMessage());
        }
    }

    // ── URI Helpers ─────────────────────────────────────────────

    private Uri toMediaStoreUriIfPossible(Uri uri) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT
                && DocumentsContract.isDocumentUri(getContext(), uri)
                && "com.android.providers.media.documents".equals(uri.getAuthority())) {
                String documentId = DocumentsContract.getDocumentId(uri);
                String[] parts = documentId.split(":");
                if (parts.length == 2 && "image".equalsIgnoreCase(parts[0])) {
                    long id = Long.parseLong(parts[1]);
                    Uri mediaUri = ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                    Log.d(TAG, "[toMediaStoreUriIfPossible] converted document URI to MediaStore: " + mediaUri);
                    return mediaUri;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "[toMediaStoreUriIfPossible] conversion failed: " + e.getMessage());
        }
        return uri;
    }

    private Uri copyUriToCache(Uri uri, int index) throws Exception {
        String extension = getExtension(uri);
        File dir = new File(getContext().getCacheDir(), "jiying-imports");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Unable to create import cache dir: " + dir.getAbsolutePath());
        }

        File outFile = new File(
            dir,
            String.format(Locale.US, "photo_%d_%02d_%s.%s",
                System.currentTimeMillis(), index, UUID.randomUUID().toString().substring(0, 8), extension)
        );

        Log.d(TAG, "[copyUriToCache] copying to: " + outFile.getAbsolutePath());
        long totalBytes = 0;

        try (InputStream input = openStream(uri); FileOutputStream output = new FileOutputStream(outFile)) {
            if (input == null) {
                throw new IllegalStateException("Unable to open source image stream for: " + uri);
            }
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
                totalBytes += read;
            }
        }

        Log.d(TAG, "[copyUriToCache] copied " + totalBytes + " bytes to " + outFile.getName());
        return Uri.fromFile(outFile);
    }

    private String getExtension(Uri uri) {
        try {
            String type = getContext().getContentResolver().getType(uri);
            String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(type);
            if (ext != null && ext.length() > 0) {
                return "jpeg".equalsIgnoreCase(ext) ? "jpg" : ext.toLowerCase(Locale.US);
            }
        } catch (Exception ignored) {}
        return "jpg";
    }

    /**
     * Open an InputStream from a URI.
     * Handles: content://, file://, no-scheme (raw path), and other schemes.
     * Returns null if the URI cannot be opened.
     */
    private InputStream openStream(Uri uri) throws Exception {
        String scheme = uri.getScheme();

        // No scheme — treat as raw filesystem path
        if (scheme == null || scheme.length() == 0) {
            String path = uri.toString();
            Log.d(TAG, "[openStream] no scheme, trying file path: " + path);
            File file = new File(path);
            if (file.exists() && file.canRead()) {
                return new FileInputStream(file);
            }
            Log.w(TAG, "[openStream] file not found or not readable: " + path);
            return null;
        }

        // file:// scheme
        if ("file".equalsIgnoreCase(scheme)) {
            String path = uri.getPath();
            Log.d(TAG, "[openStream] file:// scheme, path: " + path);
            File file = new File(path);
            if (file.exists() && file.canRead()) {
                return new FileInputStream(file);
            }
            Log.w(TAG, "[openStream] file not found or not readable: " + path);
            return null;
        }

        // content:// scheme — use ContentResolver
        if ("content".equalsIgnoreCase(scheme)) {
            ContentResolver resolver = getContext().getContentResolver();
            Log.d(TAG, "[openStream] content:// scheme, using ContentResolver");
            return resolver.openInputStream(uri);
        }

        // http://, https://, or other — cannot open
        Log.w(TAG, "[openStream] unsupported scheme: " + scheme + " — cannot open stream");
        return null;
    }

    // ── Utility ────────────────────────────────────────────────────

    private boolean isValidCoordinate(double lat, double lng) {
        return Double.isFinite(lat)
            && Double.isFinite(lng)
            && Math.abs(lat) <= 90
            && Math.abs(lng) <= 180
            && !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
    }

    private void resolveFailure(PluginCall call, String reason, String message) {
        Log.w(TAG, "[resolveFailure] reason=" + reason + " message=" + message);
        call.resolve(failureObject(reason, message));
    }

    private JSObject failureObject(String reason, String message) {
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("reason", reason);
        ret.put("source", SOURCE);
        if (message != null) {
            ret.put("message", message);
        }
        return ret;
    }

    /**
     * Enrich a result JSObject with EXIF metadata: takenAt, make, model.
     * Call after extractGpsFromExif for both GPS success and failure cases.
     */
    private void enrichWithExifMetadata(JSObject result, ExifInterface exif) {
        try {
            // Taken date/time
            String dateTimeOriginal = exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL);
            if (dateTimeOriginal == null || dateTimeOriginal.isEmpty()) {
                dateTimeOriginal = exif.getAttribute(ExifInterface.TAG_DATETIME);
            }
            if (dateTimeOriginal != null && !dateTimeOriginal.isEmpty()) {
                // Convert "2024:01:15 14:30:00" to ISO 8601
                String iso = dateTimeOriginal
                    .replaceFirst("^(\\d{4}):(\\d{2}):(\\d{2}) ", "$1-$2-$3T")
                    .replace(" ", "T");
                result.put("takenAt", iso);
                Log.d(TAG, "[enrichWithExifMetadata] takenAt: " + iso);
            } else {
                Log.d(TAG, "[enrichWithExifMetadata] no takenAt found in EXIF");
            }

            // Camera make
            String make = exif.getAttribute(ExifInterface.TAG_MAKE);
            if (make != null && !make.isEmpty()) {
                result.put("make", make.trim());
            }

            // Camera model
            String model = exif.getAttribute(ExifInterface.TAG_MODEL);
            if (model != null && !model.isEmpty()) {
                result.put("model", model.trim());
            }

            if (make != null || model != null) {
                Log.d(TAG, "[enrichWithExifMetadata] camera: " + make + " " + model);
            }
        } catch (Exception e) {
            Log.w(TAG, "[enrichWithExifMetadata] error: " + e.getMessage());
        }
    }
}
