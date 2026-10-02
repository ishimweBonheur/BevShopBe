package config

import (
	"fmt"
	"net"
	"net/url"
	"os"
)

type Config struct {
	AppEnv    string
	Port      string
	JWTSecret string

	DatabaseHost     string
	DatabasePort     string
	DatabaseName     string
	DatabaseUser     string
	DatabasePassword string

	RedisHost string
	RedisPort string
}

func Load() Config {
	return Config{
		AppEnv:    getEnv("APP_ENV", "development"),
		Port:      getEnv("PORT", "8080"),
		JWTSecret: getEnv("JWT_SECRET", "bevshop-local-secret"),

		DatabaseHost:     getEnv("DATABASE_HOST", "postgres"),
		DatabasePort:     getEnv("DATABASE_PORT", "5432"),
		DatabaseName:     getEnv("DATABASE_NAME", "beverages"),
		DatabaseUser:     getEnv("DATABASE_USER", "postgresql"),
		DatabasePassword: getEnv("DATABASE_PASSWORD", ""),

		RedisHost: getEnv("REDIS_HOST", "redis"),
		RedisPort: getEnv("REDIS_PORT", "6379"),
	}
}

func (c Config) DatabaseURL() string {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.DatabaseUser, c.DatabasePassword),
		Host:     net.JoinHostPort(c.DatabaseHost, c.DatabasePort),
		Path:     "/" + c.DatabaseName,
		RawQuery: "sslmode=disable",
	}
	return u.String()
}

func (c Config) RedisAddr() string {
	return fmt.Sprintf("%s:%s", c.RedisHost, c.RedisPort)
}

func getEnv(key, fallback string) string {
	value := os.Getenv(key)

	if value == "" {
		return fallback
	}

	return value
}
