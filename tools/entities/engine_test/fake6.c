// LD_PRELOAD shim for run_engine_test.py: when the kernel has no IPv6, emulate
// the IPv6 UDP socket BDS insists on with an IPv4 one
// (test harness only; no client ever connects).
#define _GNU_SOURCE
#include <dlfcn.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <string.h>
#include <errno.h>

static char fake[65536];
static int (*r_socket)(int,int,int);
static int (*r_bind)(int,const struct sockaddr*,socklen_t);
static int (*r_setsockopt)(int,int,int,const void*,socklen_t);
static int (*r_getsockname)(int,struct sockaddr*,socklen_t*);
static void init(void){
  if(!r_socket){
    r_socket=dlsym(RTLD_NEXT,"socket"); r_bind=dlsym(RTLD_NEXT,"bind");
    r_setsockopt=dlsym(RTLD_NEXT,"setsockopt"); r_getsockname=dlsym(RTLD_NEXT,"getsockname");
  }
}
int socket(int d,int t,int p){ init();
  if(d==AF_INET6){ int fd=r_socket(AF_INET,t,p); if(fd>=0&&fd<65536) fake[fd]=1; return fd; }
  int fd=r_socket(d,t,p); if(fd>=0&&fd<65536) fake[fd]=0; return fd; }
int bind(int fd,const struct sockaddr*a,socklen_t l){ init();
  if(fd>=0&&fd<65536&&fake[fd]&&a&&a->sa_family==AF_INET6){
    const struct sockaddr_in6*s6=(const void*)a; struct sockaddr_in s4; memset(&s4,0,sizeof s4);
    s4.sin_family=AF_INET; s4.sin_port=s6->sin6_port; s4.sin_addr.s_addr=htonl(INADDR_LOOPBACK);
    return r_bind(fd,(void*)&s4,sizeof s4); }
  return r_bind(fd,a,l); }
int setsockopt(int fd,int lv,int n,const void*v,socklen_t l){ init();
  if(fd>=0&&fd<65536&&fake[fd]&&lv==IPPROTO_IPV6) return 0;
  return r_setsockopt(fd,lv,n,v,l); }
int getsockname(int fd,struct sockaddr*a,socklen_t*l){ init();
  if(fd>=0&&fd<65536&&fake[fd]){
    struct sockaddr_in s4; socklen_t sl=sizeof s4; int r=r_getsockname(fd,(void*)&s4,&sl); if(r) return r;
    struct sockaddr_in6 s6; memset(&s6,0,sizeof s6); s6.sin6_family=AF_INET6; s6.sin6_port=s4.sin_port; s6.sin6_addr=in6addr_any;
    socklen_t n=*l<sizeof s6?*l:sizeof s6; memcpy(a,&s6,n); *l=sizeof s6; return 0; }
  return r_getsockname(fd,a,l); }
