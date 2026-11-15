FROM golang:1.24-alpine AS builder

ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z

RUN go install -v github.com/minio/minio@${MINIO_VERSION}

FROM alpine:3.22

COPY --from=builder /go/bin/minio /usr/local/bin/minio

ENTRYPOINT ["minio"]
