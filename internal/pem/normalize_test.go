package pem

import (
	"strings"
	"testing"
)

func TestEnsureTrailingNewline_empty(t *testing.T) {
	if got := EnsureTrailingNewline(""); got != "" {
		t.Errorf("got %q, want empty", got)
	}
}

func TestEnsureTrailingNewline_alreadyHasOne(t *testing.T) {
	in := "-----END CERTIFICATE-----\n"
	if got := EnsureTrailingNewline(in); got != in {
		t.Errorf("got %q, want %q", got, in)
	}
}

func TestEnsureTrailingNewline_missing(t *testing.T) {
	in := "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----"
	want := in + "\n"
	if got := EnsureTrailingNewline(in); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestEnsureTrailingNewline_stripsExtraTrailingNewlines(t *testing.T) {
	in := "-----END CERTIFICATE-----\n\n\n"
	want := "-----END CERTIFICATE-----\n"
	if got := EnsureTrailingNewline(in); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestEnsureTrailingNewline_stripsExtraTrailingCRLF(t *testing.T) {
	in := "-----END CERTIFICATE-----\r\n\r\n"
	want := "-----END CERTIFICATE-----\n"
	if got := EnsureTrailingNewline(in); got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestConcatPEMBlocks_doesNotGlueCertAndKey(t *testing.T) {
	fullchain := "-----BEGIN CERTIFICATE-----\nMIIB\n-----END CERTIFICATE-----"
	key := "-----BEGIN PRIVATE KEY-----\nMIIE\n-----END PRIVATE KEY-----"
	joined := EnsureTrailingNewline(fullchain) + EnsureTrailingNewline(key)
	if containsGluedBoundary(joined) {
		t.Fatalf("joined PEM glued cert and key: %q", joined)
	}
}

func containsGluedBoundary(s string) bool {
	return strings.Contains(s, "-----END CERTIFICATE----------BEGIN") ||
		strings.Contains(s, "-----END CERTIFICATE-----BEGIN")
}
