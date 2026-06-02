/*
 * CameraX OCR — Leitura de Medidores (Analógicos/Digitais)
 *
 * Usa CameraX + ML Kit Text Recognition para capturar e interpretar
 * leituras de medidores de energia elétrica (analógicos e digitais).
 *
 * Permissões necessárias (já no AndroidManifest):
 *   - CAMERA
 *   - Manifest.permission_group.CAMERA
 */

package com.omnigrid.omnibox

import android.Manifest
import android.content.ContentValues
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.util.Size
import android.widget.Toast
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Gerenciador de leitura de medidores via CameraX + ML Kit OCR.
 *
 * Uso:
 *   val ocr = MeterReader(context, lifecycleOwner, previewView)
 *   ocr.startCamera()
 *   ocr.readMeter { text -> /* resultado OCR */ }
 */
class MeterReader(
    private val context: Context,
    private val lifecycleOwner: LifecycleOwner,
    private val previewView: PreviewView,
) {
    private var imageCapture: ImageCapture? = null
    private var camera: Camera? = null
    private var cameraProvider: ProcessCameraProvider? = null
    private val executor: ExecutorService = Executors.newSingleThreadExecutor()
    private var onResult: ((String) -> Unit)? = null

    companion object {
        private const val TAG = "OmniBoxMeterReader"
        private const val REQUEST_CODE_CAMERA = 1001
    }

    /**
     * Inicializa a câmera com preview e ImageCapture.
     * Deve ser chamado após a permissão CAMERA ser concedida.
     */
    fun startCamera() {
        val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
        cameraProviderFuture.addListener({
            try {
                cameraProvider = cameraProviderFuture.get()
                bindCamera()
            } catch (e: Exception) {
                Log.e(TAG, "Camera init failed", e)
            }
        }, ContextCompat.getMainExecutor(context))
    }

    private fun bindCamera() {
        val provider = cameraProvider ?: return

        // Preview
        val preview = Preview.Builder()
            .build()
            .also { it.setSurfaceProvider(previewView.surfaceProvider) }

        // ImageCapture (high resolution for OCR)
        imageCapture = ImageCapture.Builder()
            .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)
            .setTargetResolution(Size(1920, 1080))
            .build()

        // Select back camera
        val cameraSelector = CameraSelector.Builder()
            .requireLensFacing(CameraSelector.LENS_FACING_BACK)
            .build()

        try {
            provider.unbindAll()
            camera = provider.bindToLifecycle(
                lifecycleOwner, cameraSelector, preview, imageCapture
            )
        } catch (e: Exception) {
            Log.e(TAG, "Camera bind failed", e)
        }
    }

    /**
     * Captura a imagem atual e executa OCR.
     * O resultado é retornado via callback.
     */
    fun readMeter(callback: (String) -> Unit) {
        onResult = callback
        val capture = imageCapture ?: return

        capture.takePicture(
            ContextCompat.getMainExecutor(context),
            object : ImageCapture.OnImageCapturedCallback() {
                override fun onCaptureSuccess(image: ImageProxy) {
                    processImage(image)
                }

                override fun onError(exception: ImageCaptureException) {
                    Log.e(TAG, "Capture error", exception)
                    callback("")
                }
            },
        )
    }

    private fun processImage(image: ImageProxy) {
        val mediaImage = image.image
        if (mediaImage == null) {
            image.close()
            onResult?.invoke("")
            return
        }

        val inputImage = InputImage.fromMediaImage(mediaImage, image.imageInfo.rotationDegrees)
        val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

        recognizer.process(inputImage)
            .addOnSuccessListener { visionText ->
                val text = visionText.text
                Log.d(TAG, "OCR result: $text")
                onResult?.invoke(text)
            }
            .addOnFailureListener { e ->
                Log.e(TAG, "OCR failed", e)
                onResult?.invoke("")
            }
            .addOnCompleteListener {
                image.close()
                recognizer.close()
            }
    }

    /**
     * Salva a imagem capturada em disco (para debug/auditoria).
     */
    fun saveCapture(image: ImageProxy): File? {
        return try {
            val buffer = image.planes[0].buffer
            val bytes = ByteArray(buffer.remaining())
            buffer.get(bytes)

            val yuvImage = YuvImage(bytes, ImageFormat.NV21, image.width, image.height, null)
            val baos = ByteArrayOutputStream()
            yuvImage.compressToJpeg(Rect(0, 0, image.width, image.height), 85, baos)
            val jpegData = baos.toByteArray()

            val dir = File(context.getExternalFilesDir(Environment.DIRECTORY_PICTURES), "meter_readings")
            dir.mkdirs()

            val file = File(dir, "meter_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())}.jpg")
            FileOutputStream(file).use { it.write(jpegData) }

            Log.i(TAG, "Capture saved: ${file.absolutePath}")
            file
        } catch (e: Exception) {
            Log.e(TAG, "Save capture failed", e)
            null
        }
    }

    /**
     * Libera recursos. Chamar quando a Activity for destruída.
     */
    fun shutdown() {
        cameraProvider?.unbindAll()
        executor.shutdown()
    }
}
