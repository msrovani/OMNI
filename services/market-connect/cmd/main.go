package main

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"os"
	"os/signal"
	"time"

	"github.com/nats-io/nats.go"
)

type PldSubmercado string

const (
	SE_CO PldSubmercado = "SE_CO"
	S     PldSubmercado = "S"
	NE    PldSubmercado = "NE"
	N     PldSubmercado = "N"
)

var allSubmercados = []PldSubmercado{SE_CO, S, NE, N}

var submercadoFactor = map[PldSubmercado]float64{
	SE_CO: 1.0,
	S:     0.95,
	NE:    0.85,
	N:     1.15,
}

type PricePointBr struct {
	Timestamp   time.Time     `json:"timestamp"`
	PrecoPorMwh float64       `json:"preco_por_mwh"`
	PrecoPorKwh float64       `json:"preco_por_kwh"`
	Submercado  PldSubmercado `json:"submercado"`
	Fonte       string        `json:"fonte"`
	Moeda       string        `json:"moeda"`
}

const pisoPLD = 69.07
const tetoPLD = 599.31

func simulatePldPrice(submercado PldSubmercado) float64 {
	hour := time.Now().Hour()
	brtHour := (hour - 3 + 24) % 24

	var base float64
	switch {
	case brtHour < 6:
		base = pisoPLD + rand.Float64()*80
	case brtHour >= 18 && brtHour < 21:
		base = 300 + rand.Float64()*250
	case brtHour >= 10 && brtHour < 17:
		base = 200 + rand.Float64()*150
	default:
		base = 100 + rand.Float64()*100
	}

	factor := submercadoFactor[submercado]
	noise := (rand.Float64() - 0.5) * 60
	price := math.Max(pisoPLD, math.Min(tetoPLD, base*factor+noise))
	return math.Round(price*100) / 100
}

func main() {
	natsURL := os.Getenv("NATS_URL")
	if natsURL == "" {
		natsURL = "nats://localhost:4222"
	}

	nc, err := nats.Connect(natsURL)
	if err != nil {
		log.Fatalf("failed to connect to NATS: %v", err)
	}
	defer nc.Close()

	log.Printf("Market Connect Brasil conectado ao NATS em %s", natsURL)
	log.Printf("Submercados PLD: SE/CO, S, NE, N")

	ticker := time.NewTicker(15 * time.Minute)
	defer ticker.Stop()

	sig := make(chan os.Signal, 1)
	signal.Notify(sig, os.Interrupt)

	for {
		select {
		case <-ticker.C:
			for _, sm := range allSubmercados {
				preco := simulatePldPrice(sm)
				price := PricePointBr{
					Timestamp:   time.Now().UTC(),
					PrecoPorMwh: preco,
					PrecoPorKwh: math.Round(preco/1000*100000) / 100000,
					Submercado:  sm,
					Fonte:       "CCEE_PLD_SIMULATED",
					Moeda:       "BRL",
				}
				data, _ := json.Marshal(price)
				subject := "market.prices." + string(sm)
				if err := nc.Publish(subject, data); err != nil {
					log.Printf("failed to publish price for %s: %v", sm, err)
				} else {
					log.Printf("PLD %s: R$ %.2f/MWh", sm, price.PrecoPorMwh)
				}
			}
		case <-sig:
			log.Println("shutting down")
			return
		}
	}
}
