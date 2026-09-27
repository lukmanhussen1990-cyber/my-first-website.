# bullyc: Lua 5.0 compiler for Bully `.lur` scripts

Built from the official Lua 5.0 sources (`git clone --branch v5.0 https://github.com/lua/lua`) with these changes:
- `llimits.h`: `typedef unsigned int Instruction;` (4-byte instructions)
- `ldump.c` is replaced with `ldump_patched.c`, which writes numbers as 4-byte floats and size_t as 4 or 8 bytes

```sh
CORE="lapi.c lcode.c ldebug.c ldo.c ldump.c lfunc.c lgc.c llex.c lmem.c lobject.c lopcodes.c lparser.c lstate.c lstring.c ltable.c ltm.c lundump.c lvm.c lzio.c lauxlib.c"
gcc -O2 -DDUMP_SIZET=4 -DDUMP_FLOAT -o bullyc32 bullyc.c $CORE -lm   # variant A
gcc -O2 -DDUMP_SIZET=8 -DDUMP_FLOAT -o bullyc64 bullyc.c $CORE -lm   # variant B
./bullyc32 STimeCycle.lua STimeCycle.lur
```
