/*
 * ipv6shim.c - LD_PRELOAD shim that lets bedrock_server start on kernels without IPv6.
 *
 * BDS 1.21.0.26 opens an IPv4 UDP socket (server-port) AND an IPv6 UDP socket
 * (server-portv6) and exits with "Port ... may be in use" if socket(AF_INET6) fails.
 * Some sandboxes/VMs run kernels built without IPv6 (socket() -> EAFNOSUPPORT).
 *
 * When (and only when) the real socket(AF_INET6, ...) call fails with EAFNOSUPPORT,
 * this shim hands out an IPv4 socket instead and translates addresses on that fd:
 *   bind():        [::]:port / v4-mapped  ->  0.0.0.0:port (other v6 -> 127.0.0.1:port)
 *   setsockopt():  IPPROTO_IPV6 options are accepted and ignored
 *   getsockname(), getpeername(), recvfrom(): IPv4 result -> v4-mapped IPv6 address
 *   sendto():      v4-mapped destination -> IPv4; other IPv6 destinations are dropped
 * On machines with working IPv6 the shim is a no-op.
 *
 * Build: gcc -O2 -shared -fPIC -o ipv6shim.so ipv6shim.c -ldl
 */
#define _GNU_SOURCE
#include <dlfcn.h>
#include <errno.h>
#include <netinet/in.h>
#include <stdint.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#define MAX_FD 65536
static unsigned char fake6[MAX_FD];

static int is_fake(int fd) { return fd >= 0 && fd < MAX_FD && fake6[fd]; }

#define REAL(name) static __typeof__(name) *real_##name; \
    if (!real_##name) real_##name = (__typeof__(name) *)dlsym(RTLD_NEXT, #name)

static void v4_to_v6(const struct sockaddr_in *in4, struct sockaddr *out, socklen_t *len) {
    struct sockaddr_in6 s6;
    memset(&s6, 0, sizeof s6);
    s6.sin6_family = AF_INET6;
    s6.sin6_port = in4->sin_port;
    if (in4->sin_addr.s_addr != htonl(INADDR_ANY)) {
        s6.sin6_addr.s6_addr[10] = 0xff;
        s6.sin6_addr.s6_addr[11] = 0xff;
        memcpy(&s6.sin6_addr.s6_addr[12], &in4->sin_addr.s_addr, 4);
    }
    socklen_t cap = *len;
    memcpy(out, &s6, cap < sizeof s6 ? cap : sizeof s6);
    *len = sizeof s6;
}

/* returns 1 when the v6 address could be mapped to IPv4 */
static int v6_to_v4(const struct sockaddr_in6 *s6, struct sockaddr_in *out, int for_bind) {
    static const unsigned char mapped[12] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff};
    static const unsigned char any[16] = {0};
    memset(out, 0, sizeof *out);
    out->sin_family = AF_INET;
    out->sin_port = s6->sin6_port;
    if (memcmp(s6->sin6_addr.s6_addr, any, 16) == 0) {
        out->sin_addr.s_addr = htonl(INADDR_ANY);
        return 1;
    }
    if (memcmp(s6->sin6_addr.s6_addr, mapped, 12) == 0) {
        memcpy(&out->sin_addr.s_addr, &s6->sin6_addr.s6_addr[12], 4);
        return 1;
    }
    if (for_bind) {
        out->sin_addr.s_addr = htonl(INADDR_LOOPBACK);
        return 1;
    }
    return 0;
}

int socket(int domain, int type, int protocol) {
    REAL(socket);
    int fd = real_socket(domain, type, protocol);
    if (fd < 0 && domain == AF_INET6 && errno == EAFNOSUPPORT) {
        fd = real_socket(AF_INET, type, protocol);
        if (fd >= 0 && fd < MAX_FD) fake6[fd] = 1;
    } else if (fd >= 0 && fd < MAX_FD) {
        fake6[fd] = 0;
    }
    return fd;
}

int close(int fd) {
    REAL(close);
    if (fd >= 0 && fd < MAX_FD) fake6[fd] = 0;
    return real_close(fd);
}

int bind(int fd, const struct sockaddr *addr, socklen_t len) {
    REAL(bind);
    if (is_fake(fd) && addr && addr->sa_family == AF_INET6) {
        struct sockaddr_in in4;
        v6_to_v4((const struct sockaddr_in6 *)addr, &in4, 1);
        return real_bind(fd, (const struct sockaddr *)&in4, sizeof in4);
    }
    return real_bind(fd, addr, len);
}

int setsockopt(int fd, int level, int name, const void *val, socklen_t len) {
    REAL(setsockopt);
    if (is_fake(fd) && level == IPPROTO_IPV6) return 0;
    return real_setsockopt(fd, level, name, val, len);
}

int getsockname(int fd, struct sockaddr *addr, socklen_t *len) {
    REAL(getsockname);
    if (!is_fake(fd)) return real_getsockname(fd, addr, len);
    struct sockaddr_in in4;
    socklen_t l4 = sizeof in4;
    int r = real_getsockname(fd, (struct sockaddr *)&in4, &l4);
    if (r == 0 && addr && len) v4_to_v6(&in4, addr, len);
    return r;
}

int getpeername(int fd, struct sockaddr *addr, socklen_t *len) {
    REAL(getpeername);
    if (!is_fake(fd)) return real_getpeername(fd, addr, len);
    struct sockaddr_in in4;
    socklen_t l4 = sizeof in4;
    int r = real_getpeername(fd, (struct sockaddr *)&in4, &l4);
    if (r == 0 && addr && len) v4_to_v6(&in4, addr, len);
    return r;
}

ssize_t recvfrom(int fd, void *buf, size_t n, int flags, struct sockaddr *addr, socklen_t *len) {
    REAL(recvfrom);
    if (!is_fake(fd) || !addr || !len) return real_recvfrom(fd, buf, n, flags, addr, len);
    struct sockaddr_in in4;
    socklen_t l4 = sizeof in4;
    ssize_t r = real_recvfrom(fd, buf, n, flags, (struct sockaddr *)&in4, &l4);
    if (r >= 0) v4_to_v6(&in4, addr, len);
    return r;
}

ssize_t sendto(int fd, const void *buf, size_t n, int flags, const struct sockaddr *addr, socklen_t len) {
    REAL(sendto);
    if (is_fake(fd) && addr && addr->sa_family == AF_INET6) {
        struct sockaddr_in in4;
        if (!v6_to_v4((const struct sockaddr_in6 *)addr, &in4, 0)) return (ssize_t)n; /* drop */
        return real_sendto(fd, buf, n, flags, (const struct sockaddr *)&in4, sizeof in4);
    }
    return real_sendto(fd, buf, n, flags, addr, len);
}
