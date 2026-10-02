FROM golang:1.27-alpine AS builder

WORKDIR /app

COPY go.mod go.sum* ./

RUN if [ -f go.sum ]; then go mod download; fi

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build \
    -trimpath \
    -ldflags="-s -w" \
    -o /app/bevshop-api \
    ./cmd/api

FROM alpine:3.22

WORKDIR /app

RUN apk add --no-cache \
    ca-certificates \
    tzdata

ENV TZ=Africa/Kigali

COPY --from=builder /app/bevshop-api ./bevshop-api

EXPOSE 8080

CMD ["./bevshop-api"]