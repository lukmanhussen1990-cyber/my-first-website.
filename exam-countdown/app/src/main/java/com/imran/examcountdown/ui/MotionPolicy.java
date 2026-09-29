package com.imran.examcountdown.ui;

import android.animation.ValueAnimator;
import android.content.Context;
import android.os.PowerManager;
import com.imran.examcountdown.core.MotionPref;
import kotlin.Metadata;
import kotlin.NoWhenBranchMatchedException;
import kotlin.jvm.internal.DefaultConstructorMarker;
import kotlin.jvm.internal.Intrinsics;

public final class MotionPolicy {
    public static final Companion Companion = new Companion(null);
    private final boolean ambient;
    private final boolean motion;

    public MotionPolicy(boolean z, boolean z2) {
        this.motion = z;
        this.ambient = z2;
    }

    public final boolean getMotion() {
        return this.motion;
    }

    public final boolean getAmbient() {
        return this.ambient;
    }

    public static final class Companion {

        public class WhenMappings {
            public static final int[] $EnumSwitchMapping$0;

            static {
                int[] iArr = new int[MotionPref.values().length];
                try {
                    iArr[MotionPref.REDUCED.ordinal()] = 1;
                } catch (NoSuchFieldError unused) {
                }
                try {
                    iArr[MotionPref.FULL.ordinal()] = 2;
                } catch (NoSuchFieldError unused2) {
                }
                try {
                    iArr[MotionPref.SYSTEM.ordinal()] = 3;
                } catch (NoSuchFieldError unused3) {
                }
                $EnumSwitchMapping$0 = iArr;
            }
        }

        public Companion(DefaultConstructorMarker defaultConstructorMarker) {
            this();
        }

        private Companion() {
        }

        public final MotionPolicy resolve(Context context, MotionPref pref) {
            boolean z;
            Intrinsics.checkNotNullParameter(context, "context");
            Intrinsics.checkNotNullParameter(pref, "pref");
            int i = WhenMappings.$EnumSwitchMapping$0[pref.ordinal()];
            boolean z2 = false;
            if (i == 1) {
                z = false;
            } else if (i == 2) {
                z = true;
            } else if (i != 3) {
                throw new NoWhenBranchMatchedException();
            } else {
                z = ValueAnimator.areAnimatorsEnabled();
            }
            PowerManager powerManager = (PowerManager) context.getSystemService(PowerManager.class);
            boolean z3 = powerManager != null && powerManager.isPowerSaveMode();
            if (z && !z3) {
                z2 = true;
            }
            return new MotionPolicy(z, z2);
        }
    }
}
