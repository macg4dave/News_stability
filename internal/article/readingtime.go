// SPDX-FileCopyrightText: Copyright The Miniflux Authors. All rights reserved.
// SPDX-License-Identifier: Apache-2.0
//
// Adapted from Miniflux internal/reader/readingtime/readingtime.go at
// fb043227ef6ad98569c848e8cdade0d237dab87e.
// Modified for News Stability: HTML tokenization replaces StripTags; speeds are
// fixed at 200 words / 500 CJK characters per minute; the sample includes its
// hundredth letter. See THIRD_PARTY_NOTICES.md and licenses/Miniflux-Apache-2.0.txt.

package article

import (
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/net/html"
)

// ReadingMinutes estimates time for the sanitized text actually shown by the
// reader. It is a presentation hint, never a read-state or full-text service.
// Empty articles have no estimate; partial feed content remains only an estimate.
func ReadingMinutes(sanitizedHTML string) int {
	text := articleText(sanitizedHTML)
	if isCJK(text, 100) {
		return (utf8.RuneCountInString(strings.TrimSpace(text)) + 499) / 500
	}
	words := 0
	for range strings.FieldsSeq(text) {
		words++
	}
	return (words + 199) / 200
}

func isCJK(text string, limit int) bool {
	var letters, totalCJK int
	for _, r := range text {
		if !unicode.IsLetter(r) {
			continue
		}
		letters++
		if unicode.In(r, unicode.Han, unicode.Hangul, unicode.Hiragana, unicode.Katakana, unicode.Yi, unicode.Bopomofo) {
			totalCJK++
		}
		if letters == limit {
			break
		}
	}
	return totalCJK > letters/2
}

// Block boundaries separate words; inline formatting must not split one word
// into several. Tokenization also decodes entities without treating them as tags.
func articleText(content string) string {
	var text strings.Builder
	tokens := html.NewTokenizer(strings.NewReader(content))
	for {
		switch tokens.Next() {
		case html.ErrorToken:
			return text.String()
		case html.TextToken:
			text.WriteString(tokens.Token().Data)
		case html.StartTagToken, html.EndTagToken, html.SelfClosingTagToken:
			switch tokens.Token().Data {
			case "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "ul", "ol", "li", "dl", "dt", "dd", "table", "thead", "tbody", "tr", "th", "td", "caption":
				text.WriteByte(' ')
			}
		}
	}
}
