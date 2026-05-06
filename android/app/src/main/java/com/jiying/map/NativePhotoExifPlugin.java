package com.jiying.map;

import android.Manifest;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import androidx.exifinterface.media.ExifInterface;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;

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
            resolveFailure(call, "INVALID_URI", "Missing uri");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && getPermissionState("mediaLocation") != PermissionState.GRANTED) {
            requestPermissionForAlias("mediaLocation", call, "mediaLocationPermsCallback");
            return;
        }

        readLocation(call);
    }

    @PermissionCallback
    private void mediaLocationPermsCallback(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
            && getPermissionState("mediaLocation") != PermissionState.GRANTED) {
            resolveFailure(call, "NO_PERMISSION", "ACCESS_MEDIA_LOCATION denied");
            return;
        }
        readLocation(call);
    }

    private void readLocation(PluginCall call) {
        String uriString = call.getString("uri");
        if (uriString == null || uriString.trim().isEmpty()) {
            resolveFailure(call, "INVALID_URI", "Missing uri");
            return;
        }

        Uri uri;
        try {
            uri = Uri.parse(uriString);
        } catch (Exception e) {
            resolveFailure(call, "INVALID_URI", e.getMessage());
            return;
        }

        Uri readableUri = uri;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q && "content".equalsIgnoreCase(uri.getScheme())) {
            try {
                readableUri = MediaStore.setRequireOriginal(uri);
            } catch (SecurityException e) {
                resolveFailure(call, "NO_PERMISSION", e.getMessage());
                return;
            } catch (IllegalArgumentException e) {
                readableUri = uri;
            }
        }

        try (InputStream stream = openStream(readableUri)) {
            if (stream == null) {
                resolveFailure(call, "READ_FAILED", "Unable to open input stream");
                return;
            }

            ExifInterface exif = new ExifInterface(stream);
            double[] latLong = exif.getLatLong();

            if (latLong != null && latLong.length >= 2 && isValidCoordinate(latLong[0], latLong[1])) {
                JSObject ret = new JSObject();
                ret.put("success", true);
                ret.put("lat", latLong[0]);
                ret.put("lng", latLong[1]);
                ret.put("source", SOURCE);
                call.resolve(ret);
            } else {
                resolveFailure(call, "NO_GPS", "No GPS EXIF location");
            }
        } catch (SecurityException e) {
            resolveFailure(call, "NO_PERMISSION", e.getMessage());
        } catch (Exception e) {
            resolveFailure(call, "READ_FAILED", e.getMessage());
        }
    }

    private InputStream openStream(Uri uri) throws Exception {
        String scheme = uri.getScheme();
        if (scheme == null || scheme.length() == 0) {
            return new FileInputStream(new File(uri.toString()));
        }
        if ("file".equalsIgnoreCase(scheme)) {
            return new FileInputStream(new File(uri.getPath()));
        }
        return getContext().getContentResolver().openInputStream(uri);
    }

    private boolean isValidCoordinate(double lat, double lng) {
        return Double.isFinite(lat)
            && Double.isFinite(lng)
            && Math.abs(lat) <= 90
            && Math.abs(lng) <= 180
            && !(Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001);
    }

    private void resolveFailure(PluginCall call, String reason, String message) {
        JSObject ret = new JSObject();
        ret.put("success", false);
        ret.put("reason", reason);
        ret.put("source", SOURCE);
        if (message != null) {
            ret.put("message", message);
        }
        call.resolve(ret);
    }
}
