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
import android.webkit.MimeTypeMap;

import androidx.activity.result.ActivityResult;
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
    private static final String SOURCE = "android_exif_original";

    @PluginMethod
    public void getLocationFromUri(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null || uriString.trim().isEmpty()) {
            resolveFailure(call, "NO_URI", "Missing uri");
            return;
        }

        if (needsMediaLocationPermission()) {
            requestPermissionForAlias("mediaLocation", call, "readLocationPermsCallback");
            return;
        }

        readLocation(call);
    }

    @PluginMethod
    public void pickImagesWithLocation(PluginCall call) {
        if (needsMediaLocationPermission()) {
            requestPermissionForAlias("mediaLocation", call, "pickImagesPermsCallback");
            return;
        }

        openOriginalImagePicker(call);
    }

    @PermissionCallback
    private void readLocationPermsCallback(PluginCall call) {
        if (needsMediaLocationPermission()) {
            resolveFailure(call, "NO_PERMISSION", "ACCESS_MEDIA_LOCATION denied");
            return;
        }
        readLocation(call);
    }

    @PermissionCallback
    private void pickImagesPermsCallback(PluginCall call) {
        if (needsMediaLocationPermission()) {
            JSObject ret = new JSObject();
            ret.put("photos", new JSArray());
            ret.put("success", false);
            ret.put("reason", "NO_PERMISSION");
            ret.put("message", "ACCESS_MEDIA_LOCATION denied");
            call.resolve(ret);
            return;
        }
        openOriginalImagePicker(call);
    }

    private boolean needsMediaLocationPermission() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && getPermissionState("mediaLocation") != PermissionState.GRANTED;
    }

    private void openOriginalImagePicker(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("image/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, call.getInt("limit", 50) > 1);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);

        startActivityForResult(call, intent, "pickImagesResult");
    }

    @ActivityCallback
    private void pickImagesResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            return;
        }

        JSObject ret = new JSObject();
        JSArray photos = new JSArray();
        ret.put("photos", photos);

        if (result.getResultCode() == Activity.RESULT_CANCELED) {
            ret.put("success", true);
            call.resolve(ret);
            return;
        }

        Intent data = result.getData();
        if (result.getResultCode() != Activity.RESULT_OK || data == null) {
            ret.put("success", false);
            ret.put("reason", "READ_FAILED");
            ret.put("message", "No picker result");
            call.resolve(ret);
            return;
        }

        int limit = Math.max(1, Math.min(call.getInt("limit", 50), 100));
        List<Uri> uris = collectUris(data, limit);
        for (int i = 0; i < uris.size(); i++) {
            Uri uri = uris.get(i);
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
                if (uri != null) {
                    uris.add(uri);
                }
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
        } catch (Exception ignored) {
            // Some providers grant temporary access only. The current import can still continue.
        }
    }

    private JSObject buildPickedPhoto(Uri originalUri, int index) {
        JSObject ret = new JSObject();
        ret.put("uri", originalUri.toString());
        ret.put("sourceUri", originalUri.toString());
        ret.put("originalUri", originalUri.toString());
        ret.put("nativeLocation", readLocationForUri(originalUri));

        try {
            Uri cacheUri = copyUriToCache(originalUri, index);
            ret.put("path", cacheUri.toString());
            ret.put("webPath", FileUtils.getPortablePath(getContext(), bridge.getLocalUrl(), cacheUri));
            ret.put("name", new File(cacheUri.getPath()).getName());
        } catch (Exception e) {
            ret.put("error", "COPY_FAILED");
            ret.put("message", e.getMessage());
        }

        return ret;
    }

    private void readLocation(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null || uriString.trim().isEmpty()) {
            resolveFailure(call, "NO_URI", "Missing uri");
            return;
        }

        Uri uri;
        try {
            uri = Uri.parse(uriString);
        } catch (Exception e) {
            resolveFailure(call, "INVALID_URI", e.getMessage());
            return;
        }

        call.resolve(readLocationForUri(uri));
    }

    private JSObject readLocationForUri(Uri uri) {
        if (uri == null) {
            return failureObject("NO_URI", "Missing uri");
        }

        Uri readableUri = uri;
        boolean originalDenied = false;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && "content".equalsIgnoreCase(uri.getScheme())) {
            Uri mediaUri = toMediaStoreUriIfPossible(uri);
            Uri originalUri = null;

            try {
                originalUri = MediaStore.setRequireOriginal(mediaUri);
            } catch (SecurityException e) {
                originalDenied = true;
            } catch (Exception ignored) {
                // Not every provider URI can be wrapped by MediaStore.
            }

            if (originalUri == null && !mediaUri.equals(uri)) {
                try {
                    originalUri = MediaStore.setRequireOriginal(uri);
                } catch (SecurityException e) {
                    originalDenied = true;
                } catch (Exception ignored) {
                    // Fall back to the granted URI below.
                }
            }

            if (originalUri != null) {
                readableUri = originalUri;
            }
        }

        try (InputStream stream = openStream(readableUri)) {
            if (stream == null) {
                return failureObject("READ_FAILED", "Unable to open input stream");
            }

            ExifInterface exif = new ExifInterface(stream);
            double[] latLong = exif.getLatLong();

            if (latLong != null && latLong.length >= 2 && isValidCoordinate(latLong[0], latLong[1])) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("lat", latLong[0]);
                ret.put("lng", latLong[1]);
                ret.put("source", SOURCE);
                return ret;
            }

            if (originalDenied) {
                return failureObject("NO_PERMISSION", "Original media location denied");
            }
            return failureObject("NO_GPS", "No GPS EXIF location");
        } catch (SecurityException e) {
            return failureObject("NO_PERMISSION", e.getMessage());
        } catch (Exception e) {
            return failureObject("READ_FAILED", e.getMessage());
        }
    }

    private Uri toMediaStoreUriIfPossible(Uri uri) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT
                && DocumentsContract.isDocumentUri(getContext(), uri)
                && "com.android.providers.media.documents".equals(uri.getAuthority())) {
                String documentId = DocumentsContract.getDocumentId(uri);
                String[] parts = documentId.split(":");
                if (parts.length == 2 && "image".equalsIgnoreCase(parts[0])) {
                    long id = Long.parseLong(parts[1]);
                    return ContentUris.withAppendedId(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, id);
                }
            }
        } catch (Exception ignored) {
            // Keep the original URI when the provider is not MediaStore-backed.
        }
        return uri;
    }

    private Uri copyUriToCache(Uri uri, int index) throws Exception {
        String extension = getExtension(uri);
        File dir = new File(getContext().getCacheDir(), "jiying-imports");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IllegalStateException("Unable to create import cache");
        }

        File outFile = new File(
            dir,
            String.format(Locale.US, "photo_%d_%02d_%s.%s", System.currentTimeMillis(), index, UUID.randomUUID(), extension)
        );

        try (InputStream input = openStream(uri); FileOutputStream output = new FileOutputStream(outFile)) {
            if (input == null) {
                throw new IllegalStateException("Unable to open source image");
            }
            byte[] buffer = new byte[8192];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
        }

        return Uri.fromFile(outFile);
    }

    private String getExtension(Uri uri) {
        try {
            String type = getContext().getContentResolver().getType(uri);
            String ext = MimeTypeMap.getSingleton().getExtensionFromMimeType(type);
            if (ext != null && ext.length() > 0) {
                return "jpeg".equalsIgnoreCase(ext) ? "jpg" : ext.toLowerCase(Locale.US);
            }
        } catch (Exception ignored) {
        }
        return "jpg";
    }

    private InputStream openStream(Uri uri) throws Exception {
        String scheme = uri.getScheme();
        if (scheme == null || scheme.length() == 0) {
            return new FileInputStream(new File(uri.toString()));
        }
        if ("file".equalsIgnoreCase(scheme)) {
            return new FileInputStream(new File(uri.getPath()));
        }
        ContentResolver resolver = getContext().getContentResolver();
        return resolver.openInputStream(uri);
    }

    private boolean isValidCoordinate(double lat, double lng) {
        return Double.isFinite(lat)
            && Double.isFinite(lng)
            && Math.abs(lat) <= 90
            && Math.abs(lng) <= 180
            && !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
    }

    private void resolveFailure(PluginCall call, String reason, String message) {
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
}
