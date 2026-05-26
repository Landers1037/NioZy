#!/bin/sh
# OpenSSH SSH_ASKPASS helper — prints NIOZY_SSH_PASS (used by NioZy terminal SSH sessions).
printf '%s\n' "$NIOZY_SSH_PASS"
