FROM golang:latest AS build

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o enclave-wizard .

FROM alpine:latest
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --no-cache-dir --break-system-packages ansible-runner ansible-core
WORKDIR /app
COPY --from=build /app/enclave-wizard .
EXPOSE 8080

ENTRYPOINT ["./enclave-wizard"]
