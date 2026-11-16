FROM docker-mirror.liara.ir/golang:1.24-alpine AS builder

ARG MINIO_VERSION=RELEASE.2025-10-15T17-29-55Z

ENV GOPROXY=https://package-mirror.liara.ir/repository/go/
ENV GOSUMDB=off
# A single compiler worker avoids excessive memory pressure on small VPS plans.
ENV GOFLAGS=-p=1

RUN go install -v github.com/minio/minio@${MINIO_VERSION}

FROM docker-mirror.liara.ir/alpine:3.22

COPY --from=builder /go/bin/minio /usr/local/bin/minio

ENTRYPOINT ["minio"]
