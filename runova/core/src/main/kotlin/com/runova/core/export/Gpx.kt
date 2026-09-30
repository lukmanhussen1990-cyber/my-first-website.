package com.runova.core.export

import com.runova.core.tracking.TrackPoint
import java.time.Instant
import java.util.Locale

/** Builds a GPX 1.1 document (one track segment per route segment) for export to other apps. */
object Gpx {
    fun build(name: String, points: List<TrackPoint>): String {
        val sb = StringBuilder()
        sb.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n")
        sb.append(
            "<gpx version=\"1.1\" creator=\"RUNOVA\" xmlns=\"http://www.topografix.com/GPX/1/1\" " +
                "xmlns:gpxtpx=\"http://www.garmin.com/xmlschemas/TrackPointExtension/v1\">\n",
        )
        val first = points.firstOrNull()
        if (first != null) {
            sb.append("  <metadata><time>").append(Instant.ofEpochMilli(first.wallTimeMs)).append("</time></metadata>\n")
        }
        sb.append("  <trk>\n    <name>").append(escape(name)).append("</name>\n    <type>running</type>\n")
        var seg: Int? = null
        for (p in points) {
            if (p.segment != seg) {
                if (seg != null) sb.append("    </trkseg>\n")
                sb.append("    <trkseg>\n")
                seg = p.segment
            }
            sb.append("      <trkpt lat=\"").append(fmt(p.lat)).append("\" lon=\"").append(fmt(p.lng)).append("\">")
            p.altitude?.let { sb.append("<ele>").append(String.format(Locale.US, "%.1f", it)).append("</ele>") }
            sb.append("<time>").append(Instant.ofEpochMilli(p.wallTimeMs)).append("</time>")
            p.heartRate?.let {
                sb.append("<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>").append(it)
                    .append("</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>")
            }
            sb.append("</trkpt>\n")
        }
        if (seg != null) sb.append("    </trkseg>\n")
        sb.append("  </trk>\n</gpx>\n")
        return sb.toString()
    }

    private fun fmt(v: Double) = String.format(Locale.US, "%.7f", v)

    private fun escape(s: String) = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;")
}
