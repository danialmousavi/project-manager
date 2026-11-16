FROM docker-mirror.liara.ir/alpine:3.22

ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z

# Download the official release binary instead of compiling MinIO during image
# creation. This keeps deployment practical on small single-server instances.
RUN wget -qO /usr/local/bin/minio \
    "https://dl.min.io/server/minio/release/linux-amd64/archive/minio.${MINIO_VERSION}" \
  && chmod 0755 /usr/local/bin/minio

ENTRYPOINT ["minio"]
