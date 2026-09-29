import org.objectweb.asm.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.jar.*;
import java.util.stream.*;

/**
 * Poor-man's Android lint "NewApi": lists framework (android/, java/, javax/) members referenced by the
 * app's compiled classes that do NOT exist in the minSdk framework jar (android-all-26.jar).
 * Each hit must be guarded by an SDK_INT check (or be intentionally optional).
 * Usage: java -cp asm*.jar:. ApiCheck <api26.jar> <classesDir> [<targetSdkJar for hierarchy>]
 */
public class ApiCheck {
  static Map<String, ClassInfo> lib = new HashMap<>();
  static class ClassInfo { String name, superName; String[] ifaces; Set<String> members = new HashSet<>(); }

  static ClassInfo load(JarFile jf, String internal) throws IOException {
    ClassInfo cached = lib.get(internal);
    if (cached != null) return cached;
    JarEntry e = jf.getJarEntry(internal + ".class");
    if (e == null) return null;
    ClassReader cr = new ClassReader(jf.getInputStream(e));
    final ClassInfo ci = new ClassInfo();
    cr.accept(new ClassVisitor(Opcodes.ASM9) {
      public void visit(int v, int acc, String name, String sig, String sup, String[] ifs) { ci.name = name; ci.superName = sup; ci.ifaces = ifs == null ? new String[0] : ifs; }
      public MethodVisitor visitMethod(int acc, String n, String d, String s, String[] ex) { if ((acc & Opcodes.ACC_PRIVATE) == 0) ci.members.add(n + d); return null; }
      public FieldVisitor visitField(int acc, String n, String d, String s, Object v) { if ((acc & Opcodes.ACC_PRIVATE) == 0) ci.members.add(n + ":" + d); return null; }
    }, ClassReader.SKIP_CODE | ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES);
    lib.put(internal, ci);
    return ci;
  }

  static boolean has(JarFile jf, String owner, String member) throws IOException {
    Deque<String> q = new ArrayDeque<>(); Set<String> seen = new HashSet<>(); q.add(owner);
    while (!q.isEmpty()) {
      String c = q.poll(); if (!seen.add(c)) continue;
      ClassInfo ci = load(jf, c); if (ci == null) continue;
      if (ci.members.contains(member)) return true;
      if (ci.superName != null) q.add(ci.superName);
      q.addAll(Arrays.asList(ci.ifaces));
    }
    return false;
  }

  static boolean isFramework(String o) {
    return o.startsWith("android/") || o.startsWith("java/") || o.startsWith("javax/") || o.startsWith("dalvik/") || o.startsWith("org/json/") || o.startsWith("org/w3c/") || o.startsWith("org/xml/");
  }

  public static void main(String[] a) throws Exception {
    JarFile jf = new JarFile(a[0]);
    Path dir = Paths.get(a[1]);
    List<Path> files;
    try (Stream<Path> s = Files.walk(dir)) { files = s.filter(p -> p.toString().endsWith(".class")).collect(Collectors.toList()); }
    Set<String> appClasses = new HashSet<>();
    for (Path p : files) appClasses.add(dir.relativize(p).toString().replaceAll("\\.class$", ""));
    TreeMap<String, TreeSet<String>> hits = new TreeMap<>();
    for (Path p : files) {
      byte[] b = Files.readAllBytes(p);
      String cls = dir.relativize(p).toString().replaceAll("\\.class$", "");
      new ClassReader(b).accept(new ClassVisitor(Opcodes.ASM9) {
        public MethodVisitor visitMethod(int acc, String mn, String md, String s, String[] ex) {
          return new MethodVisitor(Opcodes.ASM9) {
            void chk(String owner, String member, String kind) {
              if (owner.startsWith("[")) return;
              if (!isFramework(owner) || appClasses.contains(owner)) return;
              try {
                if (load(jf, owner) == null) { hits.computeIfAbsent(kind + " CLASS " + owner, k -> new TreeSet<>()).add(cls + "." + mn); return; }
                if (!has(jf, owner, member)) hits.computeIfAbsent(kind + " " + owner + "." + member, k -> new TreeSet<>()).add(cls + "." + mn);
              } catch (IOException e) { throw new UncheckedIOException(e); }
            }
            public void visitMethodInsn(int op, String o, String n, String d, boolean itf) { chk(o, n + d, "METHOD"); }
            public void visitFieldInsn(int op, String o, String n, String d) { chk(o, n + ":" + d, "FIELD"); }
            public void visitTypeInsn(int op, String t) { chk(t, "", "TYPE"); }
          };
        }
      }, ClassReader.SKIP_DEBUG | ClassReader.SKIP_FRAMES);
    }
    // TYPE checks with empty member always 'has' false except class missing; treat member "" as class-existence only
    hits.entrySet().removeIf(e -> e.getKey().startsWith("TYPE ") && !e.getKey().contains("CLASS"));
    for (Map.Entry<String, TreeSet<String>> e : hits.entrySet())
      System.out.println(e.getKey() + "\n    used in: " + String.join(", ", e.getValue().stream().limit(6).collect(Collectors.toList())) + (e.getValue().size() > 6 ? " (+" + (e.getValue().size() - 6) + " more)" : ""));
    System.out.println("API-CHECK: " + hits.size() + " framework references missing from API 26");
  }
}
