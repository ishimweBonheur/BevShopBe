package main

import (
	"bevshop/internal/auth"
	"bevshop/internal/category"
	"bevshop/internal/config"
	"bevshop/internal/damaged"
	"bevshop/internal/database"
	"bevshop/internal/docs"
	"bevshop/internal/expense"
	"bevshop/internal/owner_money"
	"bevshop/internal/product"
	"bevshop/internal/purchase"
	"bevshop/internal/report"
	"bevshop/internal/sale"
	"bevshop/internal/supplier"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

type HealthResponse struct {
	Status   string `json:"status"`
	Service  string `json:"service"`
	Postgres string `json:"postgres"`
	Redis    string `json:"redis"`
	Time     string `json:"time"`
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		allowedOrigins := map[string]bool{
			"http://localhost:5173":            true,
			"http://127.0.0.1:5173":            true,
			"https://beverages-six.vercel.app": true,
		}

		if allowedOrigins[origin] {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
		}

		w.Header().Set(
			"Access-Control-Allow-Methods",
			"GET, POST, PUT, PATCH, DELETE, OPTIONS",
		)

		w.Header().Set(
			"Access-Control-Allow-Headers",
			"Authorization, Content-Type",
		)

		w.Header().Set(
			"Access-Control-Max-Age",
			"86400",
		)

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	// Rwanda timezone
	location, err := time.LoadLocation("Africa/Kigali")
	if err != nil {
		log.Fatalf("failed to load timezone: %v", err)
	}

	time.Local = location

	// Configuration
	cfg := config.Load()

	ctx := context.Background()

	// PostgreSQL
	db, err := database.NewPostgres(ctx, cfg.DatabaseURL())
	if err != nil {
		log.Fatalf("postgres connection failed: %v", err)
	}
	defer db.Close()

	// Redis
	redisClient, err := database.NewRedis(ctx, cfg.RedisAddr())
	if err != nil {
		log.Fatalf("redis connection failed: %v", err)
	}
	defer redisClient.Close()

	// Router
	mux := http.NewServeMux()

	// JWT middleware
	jwtMiddleware := auth.NewMiddleware(cfg.JWTSecret, redisClient)

	// Health
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		response := HealthResponse{
			Status:   "ok",
			Service:  "bevshop-api",
			Postgres: "ok",
			Redis:    "ok",
			Time:     time.Now().Format(time.RFC3339),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)

		if err := json.NewEncoder(w).Encode(response); err != nil {
			log.Printf("failed to encode health response: %v", err)
		}
	})

	// Swagger / docs
	docs.Register(mux)

	// Auth
	authRepo := auth.NewRepository(db)
	authService := auth.NewService(authRepo, cfg.JWTSecret)
	authHandler := auth.NewHandler(authService, redisClient)
	authHandler.Register(mux)

	// Categories
	categoryRepo := category.NewRepository(db)
	categoryService := category.NewService(categoryRepo)
	categoryHandler := category.NewHandler(categoryService)
	categoryHandler.Register(mux)

	// Products
	productRepo := product.NewRepository(db)
	productService := product.NewService(productRepo)
	productHandler := product.NewHandler(productService)
	productHandler.Register(mux)

	// Suppliers
	supplierRepo := supplier.NewRepository(db)
	supplierService := supplier.NewService(supplierRepo)
	supplierHandler := supplier.NewHandler(supplierService)
	supplierHandler.Register(mux)

	// Purchases
	purchaseRepo := purchase.NewRepository(db)
	purchaseService := purchase.NewService(purchaseRepo)
	purchaseHandler := purchase.NewHandler(purchaseService)
	purchaseHandler.Register(mux)

	// Sales
	saleRepo := sale.NewRepository(db)
	saleService := sale.NewService(saleRepo)
	saleHandler := sale.NewHandler(saleService)
	saleHandler.Register(mux)

	// Expenses
	expenseRepo := expense.NewRepository(db)
	expenseService := expense.NewService(expenseRepo)
	expenseHandler := expense.NewHandler(expenseService)
	expenseHandler.Register(mux)

	// Damaged Items
	damagedRepo := damaged.NewRepository(db)
	damagedService := damaged.NewService(damagedRepo)
	damagedHandler := damaged.NewHandler(damagedService)
	damagedHandler.Register(mux)

	// Owner Money
	ownerMoneyRepo := owner_money.NewRepository(db)
	ownerMoneyService := owner_money.NewService(ownerMoneyRepo)
	ownerMoneyHandler := owner_money.NewHandler(ownerMoneyService)
	ownerMoneyHandler.Register(mux)

	// Reports
	reportRepo := report.NewRepository(db)
	reportService := report.NewService(reportRepo)
	reportHandler := report.NewHandler(reportService)
	reportHandler.Register(mux)

	// Middleware order:
	// browser -> CORS -> JWT -> routes
	handler := corsMiddleware(jwtMiddleware.Wrap(mux))

	// HTTP server
	server := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Printf("bevshop API running on port %s", cfg.Port)

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("server failed: %v", err)
	}
}
