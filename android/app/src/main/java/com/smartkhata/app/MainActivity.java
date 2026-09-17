package com.smartkhata.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WhatsAppIntentPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

