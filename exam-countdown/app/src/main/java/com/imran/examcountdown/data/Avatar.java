package com.imran.examcountdown.data;

import android.content.ContentResolver;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.Build;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import kotlin.Metadata;
import kotlin.Unit;
import kotlin.io.CloseableKt;
import kotlin.jvm.internal.Intrinsics;
import kotlin.ranges.RangesKt;

public final class Avatar {
    private static final String FILE = "avatar.jpg";
    public static final Avatar INSTANCE = new Avatar();

    public static void $r8$lambda$A2DB5FlsDvJCKFVcs89mlHRZaq8(int i, ImageDecoder imageDecoder, ImageDecoder.ImageInfo imageInfo, ImageDecoder.Source source) {
        decodeForCrop$lambda$3(i, imageDecoder, imageInfo, source);
    }

    private Avatar() {
    }

    public final File file(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        return new File(context.getFilesDir(), FILE);
    }

    public final boolean exists(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        return new Store(context).getAvatarVersion() != 0 && file(context).exists();
    }

    public final Bitmap load(Context context, int i) {
        Intrinsics.checkNotNullParameter(context, "context");
        if (!exists(context)) {
            return null;
        }
        String absolutePath = file(context).getAbsolutePath();
        BitmapFactory.Options options = new BitmapFactory.Options();
        int i2 = 1;
        options.inJustDecodeBounds = true;
        BitmapFactory.decodeFile(absolutePath, options);
        if (options.outWidth <= 0) {
            return null;
        }
        while (true) {
            int i3 = i2 * 2;
            if (options.outWidth / i3 < i) {
                BitmapFactory.Options options2 = new BitmapFactory.Options();
                options2.inSampleSize = i2;
                return BitmapFactory.decodeFile(absolutePath, options2);
            }
            i2 = i3;
        }
    }

    public final boolean save(Context context, Bitmap bitmap) {
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(bitmap, "bitmap");
        File file = file(context);
        File file2 = new File(context.getFilesDir(), "avatar.jpg.tmp");
        try {
            FileOutputStream fileOutputStream = new FileOutputStream(file2);
            Throwable th = null;
            boolean compress;
            try {
                compress = bitmap.compress(Bitmap.CompressFormat.JPEG, 92, fileOutputStream);
            } catch (Throwable th2) {
                th = th2;
                throw th2;
            } finally {
                CloseableKt.closeFinally(fileOutputStream, th);
            }
            if (!compress) {
                return false;
            }
            if (!file2.renameTo(file)) {
                file.delete();
                if (!file2.renameTo(file)) {
                    return false;
                }
            }
            new Store(context).setAvatarVersion(System.currentTimeMillis());
            return true;
        } catch (IOException unused) {
            file2.delete();
            return false;
        }
    }

    public final void remove(Context context) {
        Intrinsics.checkNotNullParameter(context, "context");
        file(context).delete();
        new Store(context).setAvatarVersion(0L);
    }

    public static Bitmap decodeForCrop$default(Avatar avatar, Context context, Uri uri, int i, int i2, Object obj) {
        if ((i2 & 4) != 0) {
            i = 2048;
        }
        return avatar.decodeForCrop(context, uri, i);
    }

    public final Bitmap decodeForCrop(Context context, Uri uri, int i) {
        Bitmap decodeLegacy;
        Intrinsics.checkNotNullParameter(context, "context");
        Intrinsics.checkNotNullParameter(uri, "uri");
        try {
            if (Build.VERSION.SDK_INT >= 28) {
                ImageDecoder.Source createSource = ImageDecoder.createSource(context.getContentResolver(), uri);
                Intrinsics.checkNotNullExpressionValue(createSource, "createSource(...)");
                decodeLegacy = ImageDecoder.decodeBitmap(createSource, new Avatar$$ExternalSyntheticLambda0(i));
            } else {
                decodeLegacy = decodeLegacy(context, uri, i);
            }
            return decodeLegacy;
        } catch (Exception unused) {
            return null;
        }
    }

    private static final void decodeForCrop$lambda$3(int i, ImageDecoder decoder, ImageDecoder.ImageInfo info, ImageDecoder.Source source) {
        Intrinsics.checkNotNullParameter(decoder, "decoder");
        Intrinsics.checkNotNullParameter(info, "info");
        Intrinsics.checkNotNullParameter(source, "<unused var>");
        int max = Math.max(info.getSize().getWidth(), info.getSize().getHeight());
        if (max > i) {
            float f = ((float) i) / ((float) max);
            decoder.setTargetSize(RangesKt.coerceAtLeast((int) (info.getSize().getWidth() * f), 1), RangesKt.coerceAtLeast((int) (info.getSize().getHeight() * f), 1));
        }
        decoder.setAllocator(1);
    }

    private final Bitmap decodeLegacy(Context context, Uri uri, int i) throws IOException {
        float f;
        ContentResolver contentResolver = context.getContentResolver();
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inJustDecodeBounds = true;
        InputStream openInputStream = contentResolver.openInputStream(uri);
        if (openInputStream == null) {
            return null;
        }
        Bitmap decodeStream;
        Throwable th = null;
        try {
            decodeStream = BitmapFactory.decodeStream(openInputStream, null, options);
        } catch (Throwable th2) {
            th = th2;
            throw th2;
        } finally {
            CloseableKt.closeFinally(openInputStream, th);
        }
        if (decodeStream == null) {
            return null;
        }
        if (options.outWidth <= 0) {
            return null;
        }
        int i2 = 1;
        while (true) {
            int i3 = i2 * 2;
            if (Math.max(options.outWidth, options.outHeight) / i3 < i) {
                break;
            }
            i2 = i3;
        }
        InputStream openInputStream2 = contentResolver.openInputStream(uri);
        if (openInputStream2 == null) {
            return null;
        }
        Bitmap decodeStream2;
        Throwable th3 = null;
        try {
            BitmapFactory.Options options2 = new BitmapFactory.Options();
            options2.inSampleSize = i2;
            decodeStream2 = BitmapFactory.decodeStream(openInputStream2, null, options2);
        } catch (Throwable th4) {
            th3 = th4;
            throw th4;
        } finally {
            CloseableKt.closeFinally(openInputStream2, th3);
        }
        if (decodeStream2 == null) {
            return null;
        }
        InputStream openInputStream3 = contentResolver.openInputStream(uri);
        if (openInputStream3 != null) {
            Throwable th5 = null;
            try {
                int attributeInt = new ExifInterface(openInputStream3).getAttributeInt("Orientation", 1);
                f = attributeInt != 3 ? attributeInt != 6 ? attributeInt != 8 ? 0.0f : 270.0f : 90.0f : 180.0f;
            } catch (Throwable th6) {
                th5 = th6;
                throw th6;
            } finally {
                CloseableKt.closeFinally(openInputStream3, th5);
            }
        } else {
            f = 0.0f;
        }
        if (f == 0.0f) {
            return decodeStream2;
        }
        Matrix matrix = new Matrix();
        matrix.postRotate(f);
        return Bitmap.createBitmap(decodeStream2, 0, 0, decodeStream2.getWidth(), decodeStream2.getHeight(), matrix, true);
    }
}
