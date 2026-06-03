export interface MovieMetadata {
  year?: number;
  director?: string;
  stars?: string;
  runtime?: string;
}

/**
 * Extracts IMDb ID (e.g. tt0357413) from an IMDb URL.
 */
export function extractImdbId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/title\/(t{1,2}\d+)/i);
  if (!match) return null;
  let id = match[1].toLowerCase();
  if (id.startsWith("t") && !id.startsWith("tt")) {
    id = "tt" + id.substring(1);
  }
  return id;
}

/**
 * Fetches movie details (director, stars, runtime, year) from Wikidata or OMDb.
 */
export async function fetchMovieMetadata(imdbUrl: string): Promise<MovieMetadata | null> {
  const imdbId = extractImdbId(imdbUrl);
  if (!imdbId) return null;

  // 1. Try OMDb API if key is present
  const omdbKey = process.env.OMDB_API_KEY;
  if (omdbKey) {
    try {
      const res = await fetch(`http://www.omdbapi.com/?i=${imdbId}&apikey=${omdbKey}`);
      if (res.ok) {
        const data = await res.json();
        if (data.Response !== "False") {
          return {
            year: data.Year ? parseInt(data.Year, 10) : undefined,
            director: data.Director && data.Director !== "N/A" ? data.Director : undefined,
            stars: data.Actors && data.Actors !== "N/A" ? data.Actors : undefined,
            runtime: data.Runtime && data.Runtime !== "N/A" ? data.Runtime : undefined,
          };
        }
      }
    } catch (e) {
      console.error("OMDb API fetch failed, falling back to Wikidata:", e);
    }
  }

  // 2. Default/Fallback: Query Wikidata SPARQL API (No keys needed, no WAF blocks)
  const sparqlQuery = `
    SELECT ?movie ?movieLabel ?directorLabel ?runtime ?date ?actorLabel ?sitelinks WHERE {
      ?movie wdt:P345 "${imdbId}" .
      
      OPTIONAL { ?movie wdt:P577 ?date . }
      OPTIONAL { ?movie wdt:P57 ?director . ?director rdfs:label ?directorLabel . FILTER(lang(?directorLabel) = "en") }
      OPTIONAL { ?movie wdt:P2047 ?runtime . }
      
      OPTIONAL {
        ?movie wdt:P161 ?actor .
        ?actor wikibase:sitelinks ?sitelinks .
        ?actor rdfs:label ?actorLabel .
        FILTER(lang(?actorLabel) = "en")
      }
      
      SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
    }
    ORDER BY DESC(?sitelinks)
  `;

  const url = "https://query.wikidata.org/sparql?query=" + encodeURIComponent(sparqlQuery) + "&format=json";

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "MovieNightApp/1.0 (contact: brian@example.com) Node.js/fetch",
        "Accept": "application/sparql-results+json",
      },
      next: { revalidate: 86400 } // Cache for 1 day in Next.js
    });

    if (!res.ok) {
      console.error("Wikidata query failed with status:", res.status);
      return null;
    }

    const data = await res.json();
    const bindings = data.results?.bindings || [];
    if (bindings.length === 0) return null;

    const directors = new Set<string>();
    const cast = new Set<string>();
    let runtimeVal: string | null = null;
    let dateVal: string | null = null;

    for (const b of bindings) {
      if (b.directorLabel?.value) directors.add(b.directorLabel.value);
      if (b.runtime?.value) runtimeVal = b.runtime.value;
      if (b.date?.value) dateVal = b.date.value;
      if (b.actorLabel?.value) {
        cast.add(b.actorLabel.value);
      }
    }

    let yearVal: number | undefined = undefined;
    if (dateVal) {
      const yearMatch = dateVal.match(/^(\d{4})/);
      if (yearMatch) yearVal = parseInt(yearMatch[1], 10);
    }

    return {
      year: yearVal,
      director: directors.size > 0 ? Array.from(directors).join(", ") : undefined,
      stars: cast.size > 0 ? Array.from(cast).slice(0, 4).join(", ") : undefined, // Top 4 most popular actors
      runtime: runtimeVal ? `${runtimeVal} min` : undefined,
    };
  } catch (error) {
    console.error("Error fetching Wikidata movie details:", error);
    return null;
  }
}
