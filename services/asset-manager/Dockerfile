FROM golang:1.23-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o /asset-manager ./cmd/

FROM alpine:3.20
RUN apk --no-cache add ca-certificates
COPY --from=builder /asset-manager /usr/local/bin/asset-manager
EXPOSE 50052
CMD ["asset-manager"]
