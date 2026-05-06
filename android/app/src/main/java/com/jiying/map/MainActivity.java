package com.jiying.map;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativePhotoExifPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
