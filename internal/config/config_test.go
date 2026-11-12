package config_test

import (
	"testing"

	"newsstability/internal/config"
)

func TestLoad(t *testing.T) {
	for _, tc := range []struct {
		name    string
		addr    string
		want    string
		wantErr bool
	}{
		{name: "default", want: "127.0.0.1:8090"},
		{name: "container", addr: ":8090", want: ":8090"},
		{name: "IPv6", addr: "[::1]:8090", want: "[::1]:8090"},
		{name: "missing port", addr: "localhost", wantErr: true},
		{name: "named port", addr: "localhost:http", wantErr: true},
		{name: "zero port", addr: ":0", wantErr: true},
		{name: "out of range", addr: ":65536", wantErr: true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			cfg, err := config.Load(func(key string) string {
				if key == "HTTP_ADDR" {
					return tc.addr
				}
				return ""
			})
			if (err != nil) != tc.wantErr {
				t.Fatalf("Load error = %v, wantErr %v", err, tc.wantErr)
			}
			if !tc.wantErr && cfg.HTTPAddr != tc.want {
				t.Errorf("HTTPAddr = %q, want %q", cfg.HTTPAddr, tc.want)
			}
		})
	}
}
