package com.smartkhata.app;

import android.app.Activity;
import android.content.ComponentName;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Base64;
import android.util.Log;

import android.content.ClipData;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.net.URLEncoder;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "WhatsAppIntent")
public class WhatsAppIntentPlugin extends Plugin {

    private static final String TAG = "WhatsAppIntentPlugin";
    private static final String PKG_WHATSAPP = "com.whatsapp";
    private static final String PKG_WHATSAPP_BUSINESS = "com.whatsapp.w4b";

    /**
     * PHASE 3 — DISCOVER ACTUAL INSTALLED WHATSAPP CAPABILITIES
     * Inspects package manager and intent resolvers on the active device.
     */
    @PluginMethod
    public void discoverWhatsAppCapabilities(PluginCall call) {
        Context context = getContext();
        PackageManager pm = context.getPackageManager();
        JSObject result = new JSObject();

        // 1. Package detection
        boolean waConsumerInstalled = false;
        String waConsumerVersion = null;
        try {
            PackageInfo pInfo = pm.getPackageInfo(PKG_WHATSAPP, 0);
            waConsumerInstalled = true;
            waConsumerVersion = pInfo.versionName + " (" + pInfo.versionCode + ")";
        } catch (PackageManager.NameNotFoundException ignored) {}

        boolean waBizInstalled = false;
        String waBizVersion = null;
        try {
            PackageInfo pInfo = pm.getPackageInfo(PKG_WHATSAPP_BUSINESS, 0);
            waBizInstalled = true;
            waBizVersion = pInfo.versionName + " (" + pInfo.versionCode + ")";
        } catch (PackageManager.NameNotFoundException ignored) {}

        result.put("whatsappInstalled", waConsumerInstalled);
        result.put("whatsappVersion", waConsumerVersion);
        result.put("whatsappBusinessInstalled", waBizInstalled);
        result.put("whatsappBusinessVersion", waBizVersion);

        // 2. Query ACTION_VIEW whatsapp:// scheme
        Intent viewIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("whatsapp://send?phone=919999999999"));
        List<ResolveInfo> viewResolvers = pm.queryIntentActivities(viewIntent, 0);
        result.put("viewSchemeResolves", !viewResolvers.isEmpty());
        JSArray viewActivities = new JSArray();
        for (ResolveInfo ri : viewResolvers) {
            viewActivities.put(ri.activityInfo.packageName + "/" + ri.activityInfo.name);
        }
        result.put("viewActivities", viewActivities);

        // 3. Query ACTION_SEND image/* for com.whatsapp
        Intent sendImageIntent = new Intent(Intent.ACTION_SEND);
        sendImageIntent.setType("image/png");
        sendImageIntent.setPackage(PKG_WHATSAPP);
        List<ResolveInfo> sendResolvers = pm.queryIntentActivities(sendImageIntent, 0);
        result.put("sendImageResolves", !sendResolvers.isEmpty());
        JSArray sendActivities = new JSArray();
        for (ResolveInfo ri : sendResolvers) {
            sendActivities.put(ri.activityInfo.packageName + "/" + ri.activityInfo.name);
        }
        result.put("sendImageActivities", sendActivities);

        // 4. Query wa.me https scheme
        Intent wameIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/919999999999"));
        List<ResolveInfo> wameResolvers = pm.queryIntentActivities(wameIntent, 0);
        result.put("wameResolves", !wameResolvers.isEmpty());

        Log.i(TAG, "Capabilities discovered: " + result.toString());
        call.resolve(result);
    }

    /**
     * PHASES 4-6 — TEST INTENT MATRIX CANDIDATES
     * Executes an isolated intent experiment and records precise technical telemetry.
     */
    @PluginMethod
    public void testIntentCandidate(PluginCall call) {
        String candidate = call.getString("candidate", "G");
        String phone = call.getString("phone", "");
        String text = call.getString("text", "");
        String imageBase64 = call.getString("imageBase64", null);
        String fileName = call.getString("fileName", "receipt_test.png");
        int delayMs = call.getInt("delayMs", 100);

        Context context = getContext();
        Activity activity = getActivity();

        if (activity == null || context == null) {
            call.reject("Android Activity or Context is null");
            return;
        }

        long startTime = System.currentTimeMillis();
        JSObject telemetry = new JSObject();
        telemetry.put("candidate", candidate);
        telemetry.put("phone", phone);
        telemetry.put("requestedDelayMs", delayMs);

        try {
            // Prepare image file & secure content URI if image provided
            Uri contentUri = null;
            if (imageBase64 != null && !imageBase64.isEmpty()) {
                File cacheDir = new File(context.getCacheDir(), "receipts");
                if (!cacheDir.exists()) {
                    cacheDir.mkdirs();
                }
                File imageFile = new File(cacheDir, fileName);
                byte[] decodedBytes = Base64.decode(imageBase64, Base64.DEFAULT);
                try (FileOutputStream fos = new FileOutputStream(imageFile)) {
                    fos.write(decodedBytes);
                    fos.flush();
                }

                String authority = context.getPackageName() + ".fileprovider";
                contentUri = FileProvider.getUriForFile(context, authority, imageFile);
                telemetry.put("contentUri", contentUri.toString());
            }

            Intent primaryIntent = null;
            String mode = "unknown";
            String resolvedComponent = "unresolved";

            switch (candidate.toUpperCase()) {
                case "A": {
                    // Candidate A: ACTION_SEND + EXTRA_STREAM to com.whatsapp
                    mode = "action_send_consumer";
                    primaryIntent = new Intent(Intent.ACTION_SEND);
                    primaryIntent.setType("image/png");
                    primaryIntent.setPackage(PKG_WHATSAPP);
                    if (contentUri != null) {
                        primaryIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    }
                    if (text != null && !text.isEmpty()) {
                        primaryIntent.putExtra(Intent.EXTRA_TEXT, text);
                    }
                    primaryIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    primaryIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    break;
                }

                case "B": {
                    // Candidate B: ACTION_SEND to com.whatsapp.w4b
                    mode = "action_send_business";
                    primaryIntent = new Intent(Intent.ACTION_SEND);
                    primaryIntent.setType("image/png");
                    primaryIntent.setPackage(PKG_WHATSAPP_BUSINESS);
                    if (contentUri != null) {
                        primaryIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    }
                    if (text != null && !text.isEmpty()) {
                        primaryIntent.putExtra(Intent.EXTRA_TEXT, text);
                    }
                    primaryIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    primaryIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    break;
                }

                case "C": {
                    // Candidate C: ACTION_SEND with experimental recipient extras (jid, address, phone)
                    mode = "action_send_with_jid_extras";
                    primaryIntent = new Intent(Intent.ACTION_SEND);
                    primaryIntent.setType("image/png");
                    primaryIntent.setPackage(PKG_WHATSAPP);
                    if (contentUri != null) {
                        primaryIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    }
                    if (text != null && !text.isEmpty()) {
                        primaryIntent.putExtra(Intent.EXTRA_TEXT, text);
                    }
                    // Experimental recipient tags (historical / third-party rumors)
                    primaryIntent.putExtra("jid", phone + "@s.whatsapp.net");
                    primaryIntent.putExtra(Intent.EXTRA_PHONE_NUMBER, phone);
                    primaryIntent.putExtra("address", phone);
                    primaryIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    primaryIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    break;
                }

                case "D": {
                    // Candidate D: ACTION_VIEW whatsapp://send?phone=
                    mode = "action_view_whatsapp_scheme";
                    String encodedText = text != null ? URLEncoder.encode(text, "UTF-8") : "";
                    Uri deepUri = Uri.parse("whatsapp://send?phone=" + phone + (encodedText.isEmpty() ? "" : "&text=" + encodedText));
                    primaryIntent = new Intent(Intent.ACTION_VIEW, deepUri);
                    primaryIntent.setPackage(PKG_WHATSAPP);
                    primaryIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    break;
                }

                case "E": {
                    // Candidate E: TWO-INTENT HYPOTHESIS
                    // Intent 1: ACTION_VIEW whatsapp://send?phone=
                    // Wait delayMs -> Intent 2: ACTION_SEND image
                    mode = "two_intent_sequence";
                    String encodedText = text != null ? URLEncoder.encode(text, "UTF-8") : "";
                    Uri deepUri = Uri.parse("whatsapp://send?phone=" + phone + (encodedText.isEmpty() ? "" : "&text=" + encodedText));
                    Intent intent1 = new Intent(Intent.ACTION_VIEW, deepUri);
                    intent1.setPackage(PKG_WHATSAPP);
                    intent1.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                    final Intent intent2 = new Intent(Intent.ACTION_SEND);
                    intent2.setType("image/png");
                    intent2.setPackage(PKG_WHATSAPP);
                    if (contentUri != null) {
                        intent2.putExtra(Intent.EXTRA_STREAM, contentUri);
                    }
                    if (text != null && !text.isEmpty()) {
                        intent2.putExtra(Intent.EXTRA_TEXT, text);
                    }
                    intent2.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    intent2.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

                    // Launch Intent 1 immediately
                    activity.startActivity(intent1);
                    Log.i(TAG, "Candidate E: Launched Intent 1 (chat). Scheduling Intent 2 after " + delayMs + "ms");

                    // Post Intent 2 after delay
                    new Handler(Looper.getMainLooper()).postDelayed(() -> {
                        try {
                            activity.startActivity(intent2);
                            Log.i(TAG, "Candidate E: Launched Intent 2 (image attach)");
                        } catch (Exception e) {
                            Log.e(TAG, "Candidate E: Failed to launch Intent 2", e);
                        }
                    }, delayMs);

                    long elapsed = System.currentTimeMillis() - startTime;
                    telemetry.put("success", true);
                    telemetry.put("mode", mode);
                    telemetry.put("executionTimeMs", elapsed);
                    telemetry.put("details", "Two-intent sequence initiated with " + delayMs + "ms delay");
                    call.resolve(telemetry);
                    return;
                }

                case "F": {
                    // Candidate F: ACTION_SENDTO with smsto
                    mode = "action_sendto_smsto";
                    Uri smstoUri = Uri.parse("smsto:" + phone);
                    primaryIntent = new Intent(Intent.ACTION_SENDTO, smstoUri);
                    primaryIntent.setPackage(PKG_WHATSAPP);
                    if (contentUri != null) {
                        primaryIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                    }
                    if (text != null && !text.isEmpty()) {
                        primaryIntent.putExtra(Intent.EXTRA_TEXT, text);
                    }
                    primaryIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    primaryIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    break;
                }

                case "G":
                default: {
                    // Candidate G: Official baseline wa.me direct chat
                    mode = "baseline_wa_me";
                    String encodedText = text != null ? URLEncoder.encode(text, "UTF-8") : "";
                    Uri wameUri = Uri.parse("https://wa.me/" + phone + (encodedText.isEmpty() ? "" : "?text=" + encodedText));
                    primaryIntent = new Intent(Intent.ACTION_VIEW, wameUri);
                    primaryIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    break;
                }
            }

            // Verify resolution
            PackageManager pm = context.getPackageManager();
            List<ResolveInfo> matches = pm.queryIntentActivities(primaryIntent, 0);
            if (matches.isEmpty()) {
                telemetry.put("success", false);
                telemetry.put("mode", mode);
                telemetry.put("error", "No activity found to handle intent");
                call.resolve(telemetry);
                return;
            }

            ResolveInfo targetInfo = matches.get(0);
            resolvedComponent = targetInfo.activityInfo.packageName + "/" + targetInfo.activityInfo.name;
            telemetry.put("resolvedComponent", resolvedComponent);

            // Grant URI permission explicitly to the target package if content URI exists
            if (contentUri != null && primaryIntent.getPackage() != null) {
                context.grantUriPermission(primaryIntent.getPackage(), contentUri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }

            // Launch primary intent
            activity.startActivity(primaryIntent);

            long elapsed = System.currentTimeMillis() - startTime;
            telemetry.put("success", true);
            telemetry.put("mode", mode);
            telemetry.put("executionTimeMs", elapsed);
            telemetry.put("details", "Intent launched to " + resolvedComponent);
            Log.i(TAG, "Test candidate " + candidate + " launched successfully: " + telemetry.toString());
            call.resolve(telemetry);

        } catch (Exception ex) {
            Log.e(TAG, "Exception running candidate " + candidate, ex);
            long elapsed = System.currentTimeMillis() - startTime;
            telemetry.put("success", false);
            telemetry.put("executionTimeMs", elapsed);
            telemetry.put("error", ex.getClass().getSimpleName() + ": " + ex.getMessage());
            call.resolve(telemetry);
        }
    }

    /**
     * NATIVE RECEIPT GALLERY SAVER
     * Saves the generated receipt image directly into user-accessible Android Gallery / Photos
     * under Pictures/SmartKhata via Android Scoped Storage (MediaStore).
     * Zero dangerous storage permissions required on Android 10+ (API 29-36).
     */
    @PluginMethod
    public void saveImageToGallery(PluginCall call) {
        String imageBase64 = call.getString("imageBase64", null);
        String fileName = call.getString("fileName", "SmartKhata_Receipt_" + System.currentTimeMillis() + ".png");

        if (imageBase64 == null || imageBase64.isEmpty()) {
            call.reject("Image data (imageBase64) is required");
            return;
        }

        Context context = getContext();
        if (context == null) {
            call.reject("Android Context is null");
            return;
        }

        try {
            // Strip data:image/png;base64, prefix if present
            String cleanBase64 = imageBase64;
            if (cleanBase64.contains(";base64,")) {
                cleanBase64 = cleanBase64.split(";base64,")[1];
            }
            byte[] decodedBytes = Base64.decode(cleanBase64, Base64.DEFAULT);

            ContentValues values = new ContentValues();
            values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
            values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/SmartKhata");
                values.put(MediaStore.Images.Media.IS_PENDING, 1);
            }

            Uri uri = context.getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
            if (uri == null) {
                call.reject("Failed to create MediaStore image entry");
                return;
            }

            try (OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                if (os == null) {
                    call.reject("Failed to open output stream for MediaStore URI");
                    return;
                }
                os.write(decodedBytes);
                os.flush();
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                context.getContentResolver().update(uri, values, null, null);
            }

            // Explicit MediaScanner trigger so images show immediately in Google Photos / Gallery
            try {
                MediaScannerConnection.scanFile(
                    context,
                    new String[]{uri.toString()},
                    new String[]{"image/png"},
                    null
                );
            } catch (Exception ignored) {}

            JSObject result = new JSObject();
            result.put("success", true);
            result.put("uri", uri.toString());
            result.put("fileName", fileName);
            result.put("folder", "Pictures/SmartKhata");
            Log.i(TAG, "Receipt image saved to Gallery successfully: " + uri.toString());
            call.resolve(result);

        } catch (Exception ex) {
            Log.e(TAG, "Error saving receipt image to Gallery", ex);
            call.reject("Error saving image to Gallery: " + ex.getMessage());
        }
    }

    private Uri currentCameraPhotoUri = null;
    private File currentCameraPhotoFile = null;

    /**
     * NATIVE ANDROID CAMERA CAPTURE
     * Bypasses fragile WebView file chooser by directly launching MediaStore.ACTION_IMAGE_CAPTURE
     * with explicit FileProvider URI permission grants (including setClipData and grantUriPermission).
     * Zero runtime permissions required.
     */
    @PluginMethod
    public void capturePhoto(PluginCall call) {
        Context context = getContext();
        Activity activity = getActivity();
        if (activity == null || context == null) {
            call.reject("Activity or Context is null");
            return;
        }

        Intent takePictureIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (takePictureIntent.resolveActivity(activity.getPackageManager()) == null) {
            call.reject("No camera application available on this device");
            return;
        }

        try {
            String timeStamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(new Date());
            String imageFileName = "LEDGER_" + timeStamp + "_";
            File storageDir = context.getExternalFilesDir(Environment.DIRECTORY_PICTURES);
            if (storageDir == null) {
                storageDir = context.getCacheDir();
            }
            currentCameraPhotoFile = File.createTempFile(imageFileName, ".jpg", storageDir);
            currentCameraPhotoUri = FileProvider.getUriForFile(
                activity,
                context.getPackageName() + ".fileprovider",
                currentCameraPhotoFile
            );

            takePictureIntent.putExtra(MediaStore.EXTRA_OUTPUT, currentCameraPhotoUri);
            takePictureIntent.setClipData(ClipData.newRawUri("", currentCameraPhotoUri));
            takePictureIntent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);

            // Explicitly grant URI permission to all packages that can handle ACTION_IMAGE_CAPTURE
            List<ResolveInfo> resInfoList = activity.getPackageManager().queryIntentActivities(
                takePictureIntent,
                PackageManager.MATCH_DEFAULT_ONLY
            );
            for (ResolveInfo resolveInfo : resInfoList) {
                String packageName = resolveInfo.activityInfo.packageName;
                activity.grantUriPermission(
                    packageName,
                    currentCameraPhotoUri,
                    Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION
                );
            }

            startActivityForResult(call, takePictureIntent, "processCameraResult");
        } catch (Exception ex) {
            Log.e(TAG, "Error launching native camera", ex);
            call.reject("Error launching camera: " + ex.getMessage());
        }
    }

    @ActivityCallback
    public void processCameraResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        if (result.getResultCode() == Activity.RESULT_OK) {
            try {
                if (currentCameraPhotoFile != null && currentCameraPhotoFile.exists() && currentCameraPhotoFile.length() > 0) {
                    byte[] buffer = new byte[(int) currentCameraPhotoFile.length()];
                    try (FileInputStream fis = new FileInputStream(currentCameraPhotoFile)) {
                        int read = fis.read(buffer);
                        if (read <= 0) {
                            call.reject("Captured image file was empty");
                            return;
                        }
                    }
                    String base64Image = Base64.encodeToString(buffer, Base64.NO_WRAP);
                    JSObject res = new JSObject();
                    res.put("success", true);
                    res.put("format", "jpeg");
                    res.put("dataUrl", "data:image/jpeg;base64," + base64Image);
                    call.resolve(res);
                } else {
                    call.reject("Captured image file was empty or missing");
                }
            } catch (Exception ex) {
                Log.e(TAG, "Failed to read captured camera image", ex);
                call.reject("Failed to read captured image: " + ex.getMessage());
            }
        } else {
            // User cancelled or exited camera
            JSObject res = new JSObject();
            res.put("success", false);
            res.put("cancelled", true);
            call.resolve(res);
        }
    }
}
