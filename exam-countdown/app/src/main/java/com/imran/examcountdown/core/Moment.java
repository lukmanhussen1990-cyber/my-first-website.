package com.imran.examcountdown.core;

import kotlin.Metadata;

public final class Moment {
    private final int boot;
    private final long elapsed;
    private final long wall;

    public static Moment copy$default(Moment moment, long j, long j2, int i, int i2, Object obj) {
        if ((i2 & 1) != 0) {
            j = moment.wall;
        }
        long j3 = j;
        if ((i2 & 2) != 0) {
            j2 = moment.elapsed;
        }
        long j4 = j2;
        if ((i2 & 4) != 0) {
            i = moment.boot;
        }
        return moment.copy(j3, j4, i);
    }

    public final long component1() {
        return this.wall;
    }

    public final long component2() {
        return this.elapsed;
    }

    public final int component3() {
        return this.boot;
    }

    public final Moment copy(long j, long j2, int i) {
        return new Moment(j, j2, i);
    }

    public boolean equals(Object obj) {
        if (this == obj) {
            return true;
        }
        if (obj instanceof Moment) {
            Moment moment = (Moment) obj;
            return this.wall == moment.wall && this.elapsed == moment.elapsed && this.boot == moment.boot;
        }
        return false;
    }

    public int hashCode() {
        return (((Long.hashCode(this.wall) * 31) + Long.hashCode(this.elapsed)) * 31) + Integer.hashCode(this.boot);
    }

    public String toString() {
        return "Moment(wall=" + this.wall + ", elapsed=" + this.elapsed + ", boot=" + this.boot + ')';
    }

    public Moment(long j, long j2, int i) {
        this.wall = j;
        this.elapsed = j2;
        this.boot = i;
    }

    public final int getBoot() {
        return this.boot;
    }

    public final long getElapsed() {
        return this.elapsed;
    }

    public final long getWall() {
        return this.wall;
    }
}
