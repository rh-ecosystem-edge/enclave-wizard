package pem

import "strings"

// EnsureTrailingNewline returns pem with exactly one trailing newline.
// Empty input stays empty. Extra trailing newlines are collapsed to one.
func EnsureTrailingNewline(pem string) string {
	if pem == "" {
		return pem
	}
	return strings.TrimRight(pem, "\n") + "\n"
}
