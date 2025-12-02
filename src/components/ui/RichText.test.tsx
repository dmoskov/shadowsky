import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { byteToCharOffset, RichText } from "./RichText";

describe("byteToCharOffset", () => {
  describe("single-byte ASCII text", () => {
    it("should handle empty string", () => {
      expect(byteToCharOffset("", 0)).toBe(0);
    });

    it("should convert byte offset 0 to char offset 0", () => {
      expect(byteToCharOffset("hello", 0)).toBe(0);
    });

    it("should handle ASCII text where bytes equal characters", () => {
      const text = "hello world";
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 5)).toBe(5); // after "hello"
      expect(byteToCharOffset(text, 6)).toBe(6); // after space
      expect(byteToCharOffset(text, 11)).toBe(11); // end of string
    });

    it("should handle byte offset at end of string", () => {
      const text = "test";
      expect(byteToCharOffset(text, 4)).toBe(4);
    });

    it("should handle byte offset beyond string length", () => {
      const text = "abc";
      // When byte offset exceeds text, should return character count
      expect(byteToCharOffset(text, 10)).toBe(3);
    });
  });

  describe("multi-byte emoji", () => {
    it("should handle 4-byte emoji 🎉 (party popper)", () => {
      // 🎉 is 4 bytes in UTF-8: F0 9F 8E 89
      // In JavaScript strings, it's 2 characters (surrogate pair)
      const text = "🎉";
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 4)).toBe(2); // after the emoji (JS string index)
    });

    it("should handle emoji at start of text", () => {
      const text = "🎉hello";
      // 🎉 (4 bytes, 2 JS chars) + "hello" (5 bytes, 5 JS chars) = 7 JS chars total
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 4)).toBe(2); // after emoji (JS index 2)
      expect(byteToCharOffset(text, 5)).toBe(3); // after 'h' (JS index 3)
      expect(byteToCharOffset(text, 9)).toBe(7); // end of string (JS length 7)
    });

    it("should handle emoji in middle of text", () => {
      const text = "hi🎉bye";
      // "hi" (2 bytes, 2 chars) + 🎉 (4 bytes, 2 chars) + "bye" (3 bytes, 3 chars) = 7 JS chars
      expect(byteToCharOffset(text, 0)).toBe(0); // start
      expect(byteToCharOffset(text, 2)).toBe(2); // after "hi", before emoji
      expect(byteToCharOffset(text, 6)).toBe(4); // after emoji (JS index 4)
      expect(byteToCharOffset(text, 9)).toBe(7); // end (JS length 7)
    });

    it("should handle emoji at end of text", () => {
      const text = "hello🎉";
      // "hello" (5 bytes, 5 chars) + 🎉 (4 bytes, 2 chars) = 7 JS chars
      expect(byteToCharOffset(text, 5)).toBe(5); // after "hello", before emoji
      expect(byteToCharOffset(text, 9)).toBe(7); // end (JS length 7)
    });

    it("should handle multiple emojis", () => {
      const text = "🎉🎊🎁";
      // Each emoji is 4 bytes, 2 JS chars = 12 bytes, 6 JS chars total
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 4)).toBe(2); // after first emoji
      expect(byteToCharOffset(text, 8)).toBe(4); // after second emoji
      expect(byteToCharOffset(text, 12)).toBe(6); // end
    });

    it("should handle flag emoji (multi-codepoint)", () => {
      // 🇺🇸 is two regional indicator symbols, each 4 bytes = 8 bytes
      // Each regional indicator is 2 JS chars (surrogate pair), so 4 JS chars total
      const text = "🇺🇸";
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 4)).toBe(2); // after first regional indicator
      expect(byteToCharOffset(text, 8)).toBe(4); // end
    });
  });

  describe("CJK characters", () => {
    it("should handle Chinese characters (3 bytes each)", () => {
      // Each CJK character is typically 3 bytes in UTF-8
      const text = "中文";
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 3)).toBe(1); // after 中
      expect(byteToCharOffset(text, 6)).toBe(2); // after 文
    });

    it("should handle Japanese hiragana", () => {
      const text = "こんにちは"; // 5 hiragana characters, 15 bytes
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 3)).toBe(1);
      expect(byteToCharOffset(text, 6)).toBe(2);
      expect(byteToCharOffset(text, 15)).toBe(5);
    });

    it("should handle Korean hangul", () => {
      const text = "안녕"; // 2 Korean characters, 6 bytes
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 3)).toBe(1);
      expect(byteToCharOffset(text, 6)).toBe(2);
    });

    it("should handle mixed CJK and ASCII", () => {
      const text = "hello中文world";
      // "hello" (5) + 中文 (6) + "world" (5) = 16 bytes
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 5)).toBe(5); // after "hello"
      expect(byteToCharOffset(text, 8)).toBe(6); // after 中
      expect(byteToCharOffset(text, 11)).toBe(7); // after 文
      expect(byteToCharOffset(text, 16)).toBe(12);
    });
  });

  describe("combining diacritical marks", () => {
    it("should handle combining acute accent", () => {
      // "é" as e + combining acute = "e" (1 byte) + combining mark (2 bytes) = 3 bytes
      // But it's 2 JS characters
      const text = "e\u0301"; // e + combining acute accent
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 1)).toBe(1); // after 'e'
      expect(byteToCharOffset(text, 3)).toBe(2); // after combining mark
    });

    it("should handle precomposed vs decomposed characters", () => {
      // Precomposed é is 2 bytes (C3 A9)
      const precomposed = "é";
      expect(byteToCharOffset(precomposed, 0)).toBe(0);
      expect(byteToCharOffset(precomposed, 2)).toBe(1);

      // Decomposed e + combining accent is 3 bytes
      const decomposed = "e\u0301";
      expect(byteToCharOffset(decomposed, 0)).toBe(0);
      expect(byteToCharOffset(decomposed, 3)).toBe(2);
    });

    it("should handle multiple combining marks", () => {
      // a with multiple combining marks
      const text = "a\u0300\u0301"; // a + grave + acute (both 2 bytes each)
      // 1 byte + 2 bytes + 2 bytes = 5 bytes, 3 characters
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 1)).toBe(1); // after 'a'
      expect(byteToCharOffset(text, 3)).toBe(2); // after grave
      expect(byteToCharOffset(text, 5)).toBe(3); // after acute
    });

    it("should handle Vietnamese with complex diacritics", () => {
      // Vietnamese often uses precomposed characters
      const text = "Việt Nam";
      // V(1) + i(1) + ệ(3) + t(1) + space(1) + N(1) + a(1) + m(1) = 10 bytes
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 2)).toBe(2); // after "Vi"
      expect(byteToCharOffset(text, 5)).toBe(3); // after "ệ"
    });
  });

  describe("mixed ASCII/emoji/CJK content", () => {
    it("should handle realistic mixed content", () => {
      const text = "Hello 🌍 世界!";
      // "Hello " (6 bytes, 6 chars) + 🌍 (4 bytes, 2 chars) + " " (1 byte, 1 char)
      // + 世界 (6 bytes, 2 chars) + "!" (1 byte, 1 char) = 18 bytes, 12 JS chars
      expect(byteToCharOffset(text, 0)).toBe(0); // H
      expect(byteToCharOffset(text, 6)).toBe(6); // after "Hello ", before 🌍
      expect(byteToCharOffset(text, 10)).toBe(8); // after 🌍 (JS index 8)
      expect(byteToCharOffset(text, 11)).toBe(9); // after space
      expect(byteToCharOffset(text, 14)).toBe(10); // after 世
      expect(byteToCharOffset(text, 17)).toBe(11); // after 界
      expect(byteToCharOffset(text, 18)).toBe(12); // end
    });

    it("should handle multiple emoji types with text", () => {
      const text = "🎉Party time!🎊";
      // 🎉(4 bytes, 2 chars) + "Party time!"(11 bytes, 11 chars) + 🎊(4 bytes, 2 chars)
      // = 19 bytes, 15 JS chars
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 4)).toBe(2); // after 🎉 (JS index 2)
      expect(byteToCharOffset(text, 15)).toBe(13); // after "!" (JS index 13)
      expect(byteToCharOffset(text, 19)).toBe(15); // end (JS length 15)
    });

    it("should handle emoji surrounded by CJK", () => {
      const text = "中🎉文";
      // 中(3 bytes, 1 char) + 🎉(4 bytes, 2 chars) + 文(3 bytes, 1 char)
      // = 10 bytes, 4 JS chars
      expect(byteToCharOffset(text, 0)).toBe(0);
      expect(byteToCharOffset(text, 3)).toBe(1); // after 中
      expect(byteToCharOffset(text, 7)).toBe(3); // after 🎉 (JS index 3)
      expect(byteToCharOffset(text, 10)).toBe(4); // end (JS length 4)
    });

    it("should handle a realistic @mention scenario", () => {
      // Simulating "@user mentioned 你好🎉"
      // @user(5) + space(1) + mentioned(9) + space(1) + 你好(6 bytes, 2 chars) + 🎉(4 bytes, 2 chars)
      // = 26 bytes, 20 JS chars
      const text = "@user mentioned 你好🎉";
      expect(byteToCharOffset(text, 0)).toBe(0); // @
      expect(byteToCharOffset(text, 5)).toBe(5); // after "@user"
      expect(byteToCharOffset(text, 16)).toBe(16); // after "mentioned "
      expect(byteToCharOffset(text, 22)).toBe(18); // after 你好
      expect(byteToCharOffset(text, 26)).toBe(20); // end (JS length 20)
    });
  });

  describe("edge cases", () => {
    it("should handle byte offset in middle of multi-byte character", () => {
      // When byte offset lands in the middle of a character (1, 2, or 3 bytes into a 4-byte emoji),
      // the function processes the whole character since it iterates by codepoint.
      // This means offsets 1-3 all return the end position after the emoji.
      // This behavior is acceptable because ATProtocol facets should always
      // have proper byte boundaries aligned to character boundaries.
      const text = "🎉"; // 4 bytes, 2 JS chars
      expect(byteToCharOffset(text, 1)).toBe(2); // processes whole emoji
      expect(byteToCharOffset(text, 2)).toBe(2); // processes whole emoji
      expect(byteToCharOffset(text, 3)).toBe(2); // processes whole emoji
    });

    it("should handle zero-width joiner sequences", () => {
      // Family emoji: 👨‍👩‍👧 uses ZWJ (zero-width joiner)
      // This is complex: each person emoji + ZWJ characters
      const text = "👨‍👩‍👧";
      // The byte length will vary, but we test it handles it
      expect(byteToCharOffset(text, 0)).toBe(0);
    });

    it("should handle newlines and special whitespace", () => {
      const text = "line1\nline2\r\nline3";
      expect(byteToCharOffset(text, 5)).toBe(5); // after "line1"
      expect(byteToCharOffset(text, 6)).toBe(6); // after \n
      expect(byteToCharOffset(text, 11)).toBe(11); // after "line2"
    });

    it("should handle tabs", () => {
      const text = "col1\tcol2";
      expect(byteToCharOffset(text, 4)).toBe(4); // after "col1"
      expect(byteToCharOffset(text, 5)).toBe(5); // after tab
    });
  });
});

describe("RichText component with facets", () => {
  const renderWithRouter = (ui: React.ReactElement) => {
    return render(<BrowserRouter>{ui}</BrowserRouter>);
  };

  describe("overlapping facets", () => {
    it("should handle facets that are adjacent", () => {
      const text = "@user @other";
      const facets = [
        {
          index: { byteStart: 0, byteEnd: 5 },
          features: [
            { $type: "app.bsky.richtext.facet#mention", did: "did:plc:user1" },
          ],
        },
        {
          index: { byteStart: 6, byteEnd: 12 },
          features: [
            { $type: "app.bsky.richtext.facet#mention", did: "did:plc:user2" },
          ],
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(2);
      expect(links[0]).toHaveTextContent("@user");
      expect(links[1]).toHaveTextContent("@other");
    });

    it("should handle facets with emoji content", () => {
      const text = "Check out 🎉 the party!";
      // "Check out " = 10 bytes, 🎉 = 4 bytes
      const facets = [
        {
          index: { byteStart: 10, byteEnd: 14 }, // just the emoji
          features: [
            { $type: "app.bsky.richtext.facet#link", uri: "https://party.com" },
          ],
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      const link = screen.getByRole("link");
      expect(link).toHaveTextContent("🎉");
      expect(link).toHaveAttribute("href", "https://party.com");
    });

    it("should handle facets with CJK content", () => {
      const text = "Visit 东京 for fun!";
      // "Visit " = 6 bytes, 东京 = 6 bytes (3 each)
      const facets = [
        {
          index: { byteStart: 6, byteEnd: 12 },
          features: [
            { $type: "app.bsky.richtext.facet#link", uri: "https://tokyo.jp" },
          ],
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      const link = screen.getByRole("link");
      expect(link).toHaveTextContent("东京");
      expect(link).toHaveAttribute("href", "https://tokyo.jp");
    });
  });

  describe("malformed facet objects", () => {
    it("should handle facets with empty features array", () => {
      const text = "Hello world";
      const facets = [
        {
          index: { byteStart: 0, byteEnd: 5 },
          features: [],
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      // Should render but without links
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText(/Hello/)).toBeInTheDocument();
    });

    it("should handle facets with missing feature type", () => {
      const text = "Hello world";
      const facets = [
        {
          index: { byteStart: 0, byteEnd: 5 },
          features: [{ $type: "" }], // empty type
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      expect(screen.queryByRole("link")).toBeNull();
    });

    it("should handle mention facet without did", () => {
      const text = "@user hello";
      const facets = [
        {
          index: { byteStart: 0, byteEnd: 5 },
          features: [{ $type: "app.bsky.richtext.facet#mention" }], // missing did
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      // Should render text but not as a link
      expect(screen.queryByRole("link")).toBeNull();
    });

    it("should handle link facet without uri", () => {
      const text = "click here";
      const facets = [
        {
          index: { byteStart: 0, byteEnd: 5 },
          features: [{ $type: "app.bsky.richtext.facet#link" }], // missing uri
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      expect(screen.queryByRole("link")).toBeNull();
    });

    it("should handle tag facet without tag", () => {
      const text = "#hashtag";
      const facets = [
        {
          index: { byteStart: 0, byteEnd: 8 },
          features: [{ $type: "app.bsky.richtext.facet#tag" }], // missing tag
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      expect(screen.queryByRole("link")).toBeNull();
    });

    it("should handle facets with byteEnd before byteStart", () => {
      const text = "Hello world";
      const facets = [
        {
          index: { byteStart: 5, byteEnd: 0 }, // inverted
          features: [
            { $type: "app.bsky.richtext.facet#link", uri: "https://test.com" },
          ],
        },
      ];

      // This should not crash
      renderWithRouter(<RichText text={text} facets={facets} />);
      expect(screen.getByText(/Hello world/)).toBeInTheDocument();
    });

    it("should handle facets with byte offsets beyond text length", () => {
      const text = "Hi";
      const facets = [
        {
          index: { byteStart: 100, byteEnd: 200 },
          features: [
            { $type: "app.bsky.richtext.facet#link", uri: "https://test.com" },
          ],
        },
      ];

      // Should not crash
      renderWithRouter(<RichText text={text} facets={facets} />);
      expect(screen.getByText("Hi")).toBeInTheDocument();
    });

    it("should handle unsorted facets correctly", () => {
      const text = "first second third";
      const facets = [
        {
          index: { byteStart: 13, byteEnd: 18 }, // "third"
          features: [
            { $type: "app.bsky.richtext.facet#link", uri: "https://third.com" },
          ],
        },
        {
          index: { byteStart: 0, byteEnd: 5 }, // "first"
          features: [
            { $type: "app.bsky.richtext.facet#link", uri: "https://first.com" },
          ],
        },
        {
          index: { byteStart: 6, byteEnd: 12 }, // "second"
          features: [
            {
              $type: "app.bsky.richtext.facet#link",
              uri: "https://second.com",
            },
          ],
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      const links = screen.getAllByRole("link");
      expect(links).toHaveLength(3);
      expect(links[0]).toHaveTextContent("first");
      expect(links[1]).toHaveTextContent("second");
      expect(links[2]).toHaveTextContent("third");
    });

    it("should handle unknown feature types gracefully", () => {
      const text = "Hello world";
      const facets = [
        {
          index: { byteStart: 0, byteEnd: 5 },
          features: [{ $type: "app.bsky.richtext.facet#unknown" }],
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      // Should render as plain text span
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText(/Hello/)).toBeInTheDocument();
    });
  });

  describe("security: invalid URIs", () => {
    it("should not render javascript: URIs as clickable links", () => {
      const text = "click here";
      const facets = [
        {
          index: { byteStart: 0, byteEnd: 10 },
          features: [
            {
              $type: "app.bsky.richtext.facet#link",
              uri: "javascript:alert('xss')",
            },
          ],
        },
      ];

      renderWithRouter(<RichText text={text} facets={facets} />);

      // Should render as plain text, not as a link
      expect(screen.queryByRole("link")).toBeNull();
      expect(screen.getByText("click here")).toBeInTheDocument();
    });
  });

  describe("rendering with no facets", () => {
    it("should render plain text when facets array is empty", () => {
      renderWithRouter(<RichText text="Just plain text" facets={[]} />);
      expect(screen.getByText("Just plain text")).toBeInTheDocument();
    });

    it("should render plain text when facets is undefined", () => {
      renderWithRouter(<RichText text="Just plain text" />);
      expect(screen.getByText("Just plain text")).toBeInTheDocument();
    });

    it("should return null for empty text", () => {
      const { container } = renderWithRouter(<RichText text="" />);
      expect(container).toBeEmptyDOMElement();
    });
  });
});
