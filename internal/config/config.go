// Package config loads and validates reader process configuration.
package config

import (
	"fmt"
	"net"
	"strconv"
)

// Config contains settings used by the reader process.
type Config struct {
	HTTPAddr string
}

// Load reads environment settings through getenv, leaving process state untouched.
func Load(getenv func(string) string) (Config, error) {
	addr := getenv("HTTP_ADDR")
	if addr == "" {
		addr = "127.0.0.1:8090"
	}
	_, port, err := net.SplitHostPort(addr)
	if err != nil {
		return Config{}, fmt.Errorf("HTTP_ADDR must be host:port: %w", err)
	}
	number, err := strconv.Atoi(port)
	if err != nil || number < 1 || number > 65535 {
		return Config{}, fmt.Errorf("HTTP_ADDR port must be an integer between 1 and 65535")
	}
	return Config{HTTPAddr: addr}, nil
}
