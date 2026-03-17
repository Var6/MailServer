# ============================================================
#  Dovecot — ARM64-compatible Docker image with checkpassword auth
# ============================================================
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      dovecot-imapd \
      dovecot-pop3d \
      dovecot-lmtpd \
      dovecot-sieve \
      dovecot-managesieved \
      curl \
      gettext-base \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# vmail user (uid 5000)
RUN groupadd -g 5000 vmail && \
    useradd -u 5000 -g vmail -d /var/mail/vhosts -s /usr/sbin/nologin vmail && \
    mkdir -p /var/mail/vhosts && \
    chown vmail:vmail /var/mail/vhosts

# Checkpassword script
COPY checkpassword.sh /usr/local/bin/dovecot-checkpassword
RUN chmod 755 /usr/local/bin/dovecot-checkpassword

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 143 993 4190

ENTRYPOINT ["/entrypoint.sh"]
CMD ["dovecot", "-F"]
