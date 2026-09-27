/* bullyc: compile a Lua 5.0 source file to a .lur chunk for Bully */
#include <stdio.h>
#include <stdlib.h>
#include "lua.h"
#include "lauxlib.h"
#include "lobject.h"
#include "lstate.h"
#include "lundump.h"
static int writer(lua_State* L, const void* p, size_t size, void* u)
{ (void)L; return fwrite(p,size,1,(FILE*)u)==1 || size==0; }
int main(int argc, char** argv)
{
 lua_State* L; FILE* out; const Proto* f;
 if (argc!=3) { fprintf(stderr,"usage: %s in.lua out.lur\n",argv[0]); return 1; }
 L=lua_open();
 if (luaL_loadfile(L,argv[1])!=0) { fprintf(stderr,"%s\n",lua_tostring(L,-1)); return 1; }
 f=clvalue(L->top-1)->l.p;
 out=fopen(argv[2],"wb"); if (!out) { perror(argv[2]); return 1; }
 luaU_dump(L,f,writer,out);
 fclose(out); lua_close(L); return 0;
}
