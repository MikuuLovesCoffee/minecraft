"""Tiny helpers for building structures with vanilla commands over local RCON (run on the server)."""
import math
import socket
import struct

FAIL_WORDS = ("Unknown", "Incorrect", "Expected", "Invalid", "too many", "not loaded")


class Build:
    def __init__(self, dimension):
        self.dim = dimension
        self.cmds = []

    def c(self, cmd):
        self.cmds.append(f"execute in {self.dim} run {cmd}")

    def fill(self, x1, y1, z1, x2, y2, z2, block, mode=""):
        self.c(f"fill {x1} {y1} {z1} {x2} {y2} {z2} {block} {mode}".strip())

    def setb(self, x, y, z, block):
        self.c(f"setblock {x} {y} {z} {block}")

    def ring(self, cx, cz, r_in, r_out, y1, y2, block):
        """Fills every column whose distance from (cx, cz) is within [r_in, r_out], one fill per row segment."""
        R = int(math.ceil(r_out))
        for dx in range(-R, R + 1):
            zs = [dz for dz in range(-R, R + 1) if r_in <= math.hypot(dx, dz) <= r_out]
            # split into contiguous runs
            run = []
            for dz in zs + [None]:
                if run and (dz is None or dz != run[-1] + 1):
                    self.fill(cx + dx, y1, cz + run[0], cx + dx, y2, cz + run[-1], block)
                    run = []
                if dz is not None:
                    run.append(dz)


def rcon():
    props = dict(l.strip().split("=", 1) for l in open("/opt/minecraft/server/server.properties") if "=" in l and not l.startswith("#"))
    s = socket.create_connection(("127.0.0.1", int(props["rcon.port"])), timeout=60)

    def send(body, kind=2, rid=2):
        d = struct.pack("<ii", rid, kind) + body.encode() + b"\0\0"
        s.sendall(struct.pack("<i", len(d)) + d)
        n = struct.unpack("<i", s.recv(4))[0]
        r = b""
        while len(r) < n:
            r += s.recv(n - len(r))
        return r[8:-2].decode(errors="replace")

    send(props["rcon.password"], kind=3, rid=1)
    return send


def run(cmds, quiet_fails=("Could not set the block",)):
    send = rcon()
    errors = 0
    for i, cmd in enumerate(cmds):
        out = send(cmd)
        if any(w in out for w in FAIL_WORDS) or ("Could not" in out and not any(q in out for q in quiet_fails)):
            errors += 1
            print(f"[{i}] {cmd[:140]} -> {out[:160]}")
    print(f"{len(cmds)} commands, {errors} errors")
