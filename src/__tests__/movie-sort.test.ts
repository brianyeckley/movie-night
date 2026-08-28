import { describe, it, expect } from "vitest";
import { getSortableTitle, compareMovieTitles, sortMoviesByTitle } from "@/lib/movie-sort";

describe("movie-sort", () => {
  describe("getSortableTitle", () => {
    it("strips leading 'The ' case-insensitively", () => {
      expect(getSortableTitle("The Elephant Man")).toBe("Elephant Man");
      expect(getSortableTitle("the matrix")).toBe("matrix");
      expect(getSortableTitle("THE GODFATHER")).toBe("GODFATHER");
    });

    it("strips leading 'A ' case-insensitively", () => {
      expect(getSortableTitle("A Clockwork Orange")).toBe("Clockwork Orange");
      expect(getSortableTitle("a quiet place")).toBe("quiet place");
      expect(getSortableTitle("A Beautiful Mind")).toBe("Beautiful Mind");
    });

    it("strips leading 'An ' case-insensitively", () => {
      expect(getSortableTitle("An American Werewolf in London")).toBe("American Werewolf in London");
      expect(getSortableTitle("an affair to remember")).toBe("affair to remember");
    });

    it("does NOT strip 'The', 'A', 'An' if part of another word", () => {
      expect(getSortableTitle("There Will Be Blood")).toBe("There Will Be Blood");
      expect(getSortableTitle("They Live")).toBe("They Live");
      expect(getSortableTitle("Alien")).toBe("Alien");
      expect(getSortableTitle("Another Earth")).toBe("Another Earth");
      expect(getSortableTitle("Ant-Man")).toBe("Ant-Man");
      expect(getSortableTitle("Anchor")).toBe("Anchor");
    });

    it("handles empty or falsy strings gracefully", () => {
      expect(getSortableTitle("")).toBe("");
    });
  });

  describe("compareMovieTitles", () => {
    it("sorts 'The Elephant Man' before 'The Matrix' and under E", () => {
      const movies = [
        { title: "The Matrix" },
        { title: "Die Hard" },
        { title: "The Elephant Man" },
        { title: "Alien" },
        { title: "A Clockwork Orange" },
        { title: "Zoolander" },
      ];

      const sorted = sortMoviesByTitle(movies);
      expect(sorted.map((m) => m.title)).toEqual([
        "Alien",
        "A Clockwork Orange", // 'Clockwork Orange' -> C
        "Die Hard",
        "The Elephant Man",   // 'Elephant Man' -> E
        "The Matrix",         // 'Matrix' -> M
        "Zoolander",
      ]);
    });

    it("preserves original titles without transforming to 'Hudsucker Proxy, The'", () => {
      const movies = [
        { title: "The Hudsucker Proxy" },
        { title: "Halloween" },
        { title: "Home Alone" },
      ];

      const sorted = sortMoviesByTitle(movies);
      expect(sorted.map((m) => m.title)).toEqual([
        "Halloween",
        "Home Alone",
        "The Hudsucker Proxy", // 'Hudsucker' -> Hu (after Ho)
      ]);
      expect(sorted[2].title).toBe("The Hudsucker Proxy");
    });

    it("breaks ties with original title if normalized titles are identical", () => {
      const movies = [
        { title: "the thing" },
        { title: "The Thing" },
      ];
      const sorted = sortMoviesByTitle(movies);
      expect(sorted).toHaveLength(2);
    });
  });
});
