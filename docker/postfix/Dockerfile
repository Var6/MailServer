# ============================================================
#  Postfix — ARM64-compatible Docker image
# ============================================================
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      postfix \
      postfix-mysql \
      libsasl2-modules \
      libsasl2-modules-db \
      sasl2-bin \
      opendkim \
      opendkim-tools \
      gettext-base \
      ca-certificates \
      telnet \
      netcat-openbsd \
    && rm -rf /var/lib/apt/lists/*

# Create vmail user/group (uid/gid 5000 matches Dovecot)
RUN groupadd -g 5000 vmail && useradd -u 5000 -g vmail -s /usr/sbin/nologin vmail

# Copy entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 25 587 465

ENTRYPOINT ["/entrypoint.sh"]
CMD ["postfix", "start-fg"]
