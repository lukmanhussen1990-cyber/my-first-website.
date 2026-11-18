import bpy, os, sys, shutil, zipfile, addon_utils
zp="/opt/work/dl/mpfb2-latest.zip"
print("repos:", [(r.name, r.module, r.directory) for r in bpy.context.preferences.extensions.repos])
r = bpy.ops.extensions.package_install_files(filepath=zp, repo="user_default", enable_on_install=True)
print("install result", r)
bpy.ops.wm.save_userpref()
mods=[m.__name__ for m in addon_utils.modules()]
print([m for m in mods if 'mpfb' in m])
print("enabled:", [a.module for a in bpy.context.preferences.addons])
uh = bpy.utils.extension_path_user("bl_ext.user_default.mpfb", create=True)
print("user home:", uh)
