.PHONY: proto lint test build docker up down dev clean

# ── Protobuf ──
proto:
	cd proto && buf generate

proto-lint:
	cd proto && buf lint

# ── Python Services ──
lint-pde:
	cd services\pde-engine && ruff check .
test-pde:
	cd services\pde-engine && pytest
build-pde:
	cd services\pde-engine && docker build -t ghcr.io/omni-grid/pde-engine:latest .

# ── Golang Services ──
lint-asset:
	cd services\asset-manager && golangci-lint run
test-asset:
	cd services\asset-manager && go test ./...
build-asset:
	cd services\asset-manager && go build -o bin\asset-manager .\cmd\

lint-market:
	cd services\market-connect && golangci-lint run
test-market:
	cd services\market-connect && go test ./...
build-market:
	cd services\market-connect && go build -o bin\market-connect .\cmd\

# ── Rust Services ──
lint-omni-cloud:
	cd services\omni-cloud && cargo clippy
test-omni-cloud:
	cd services\omni-cloud && cargo test
build-omni-cloud:
	cd services\omni-cloud && cargo build --release

lint-edge-fw:
	cd edge\omni-box-fw && cargo clippy
test-edge-fw:
	cd edge\omni-box-fw && cargo test
build-edge-fw:
	cd edge\omni-box-fw && cargo build --release --target=armv7-unknown-linux-gnueabihf

# ── Docker ──
up:
	docker compose up --build -d

down:
	docker compose down -v

logs:
	docker compose logs -f

# ── Development ──
dev-up:
	docker compose up -d postgres nats redis

dev-pde:
	cd services\pde-engine && poetry run uvicorn api.app:app --reload --port 8001

# ── Database ──
migrate:
	cd services\asset-manager && go run .\cmd\migrate

# ── All Services ──
lint-all: lint-pde lint-asset lint-market lint-omni-cloud lint-edge-fw
test-all: test-pde test-asset test-market test-omni-cloud test-edge-fw
build-all: build-pde build-asset build-market build-omni-cloud build-edge-fw

# ── Clean ──
clean:
	rm -rf services\**\__pycache__
	rm -rf services\**\*.pyc
	rm -rf services\**\target
	rm -rf edge\**\target
