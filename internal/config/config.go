// Package config loads and validates reader process configuration.
package config

import (
	"fmt"
	"net"
	"net/url"
	"strconv"
	"strings"
)

// Config contains settings used by the reader process.
type Config struct {
	HTTPAddr       string
	PublicOrigin   string
	NewsBlurOrigin string
	NewsBlurCAFile string
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
	publicOrigin := getenv("PUBLIC_ORIGIN")
	if publicOrigin == "" {
		publicOrigin = "http://localhost:8080"
	}
	u, err := url.Parse(publicOrigin)
	if err != nil || u.Hostname() == "" || u.User != nil || u.Path != "" || u.RawQuery != "" || u.ForceQuery || u.Fragment != "" || u.Opaque != "" || strings.Contains(publicOrigin, "#") {
		return Config{}, fmt.Errorf("PUBLIC_ORIGIN must be an HTTP(S) origin without credentials, path, query, or fragment")
	}
	if port := u.Port(); port != "" {
		number, err := strconv.Atoi(port)
		if err != nil || number < 1 || number > 65535 {
			return Config{}, fmt.Errorf("PUBLIC_ORIGIN port must be between 1 and 65535")
		}
	}
	if u.Scheme != "https" {
		ip := net.ParseIP(u.Hostname())
		if u.Scheme != "http" || (u.Hostname() != "localhost" && (ip == nil || !ip.IsLoopback())) {
			return Config{}, fmt.Errorf("PUBLIC_ORIGIN requires HTTPS except on loopback")
		}
	}
	origin := getenv("NEWSBLUR_ORIGIN")
	if origin == "" {
		origin = "https://news101.lan"
	}
	return Config{HTTPAddr: addr, PublicOrigin: publicOrigin, NewsBlurOrigin: origin, NewsBlurCAFile: getenv("NEWSBLUR_CA_FILE")}, nil
}
