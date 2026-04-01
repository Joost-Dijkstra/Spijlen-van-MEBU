const OUTPUT_FILE = "spijlen.json";
const BASE_URL = "https://spijl-in-stijl.nl";
const PRODUCTS_ENDPOINT = `${BASE_URL}/wp-json/wc/store/products`;
const CATEGORIES_ENDPOINT = `${BASE_URL}/wp-json/wc/store/products/categories`;
const PAGE_SIZE = 100;

const INCLUDE_NAME_WORDS = ["spijl", "spijlen", "trapspijl", "trapspijlen"];
const EXCLUDE_NAME_WORDS = [
  "leuning",
  "leuningen",
  "leuningdrager",
  "leuningdragers",
  "voet",
  "voeten",
  "voetplaat",
  "voetplaten",
  "afdek",
  "afdekkap",
  "afdekpet",
  "bol",
  "bollen",
  "drager",
  "dragers",
  "strip",
  "profiel",
  "koppelstuk",
  "montage",
  "antislip",
  "paalkop",
  "hoofdbaluster",
  "baluster",
  "balusters",
];

function normalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function normalizeCode(value) {
  return normalizeText(value).replace(/\s+/g, "");
}

function stripHtml(value) {
  return repairText(String(value || ""))
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#8211;|&ndash;/gi, "-")
    .replace(/&#8217;/gi, "'")
    .replace(/&#8242;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function repairText(value) {
  let text = String(value || "");

  const replacements = new Map([
    ["â–¡", "□"],
    ["â–¢", "■"],
    ["â—‹", "○"],
    ["â—�", "●"],
    ["Ã˜", "Ø"],
    ["Â±", "±"],
    ["Ã©", "é"],
    ["Ã¨", "è"],
  ]);

  for (const [broken, fixed] of replacements) {
    text = text.replaceAll(broken, fixed);
  }

  return text;
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const cleaned = String(value || "").trim();
    if (!cleaned) {
      continue;
    }

    const key = cleaned.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(cleaned);
  }

  return result;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "spijl-in-stijl-local-search/1.0",
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed for ${url}: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function fetchAllCategories() {
  const categories = await fetchJson(CATEGORIES_ENDPOINT);
  console.log(`[scrape] Categories loaded: ${categories.length}`);
  return categories;
}

async function fetchAllProducts() {
  const firstUrl = `${PRODUCTS_ENDPOINT}?per_page=${PAGE_SIZE}&page=1`;
  const firstResponse = await fetch(firstUrl, {
    headers: {
      "user-agent": "spijl-in-stijl-local-search/1.0",
      accept: "application/json",
    },
  });

  if (!firstResponse.ok) {
    throw new Error(`Request failed for ${firstUrl}: ${firstResponse.status} ${firstResponse.statusText}`);
  }

  const totalPages = Number(firstResponse.headers.get("x-wp-totalpages") || "1");
  const allProducts = await firstResponse.json();

  console.log(`[scrape] Product pages to fetch: ${totalPages}`);

  for (let page = 2; page <= totalPages; page += 1) {
    const url = `${PRODUCTS_ENDPOINT}?per_page=${PAGE_SIZE}&page=${page}`;
    const pageProducts = await fetchJson(url);
    allProducts.push(...pageProducts);
  }

  console.log(`[scrape] Products loaded from API: ${allProducts.length}`);
  return allProducts;
}

function extractAttribute(product, names) {
  const wanted = new Set(names.map((name) => normalizeText(name)));

  for (const attribute of product.attributes || []) {
    if (!wanted.has(normalizeText(attribute.name))) {
      continue;
    }

    const terms = (attribute.terms || []).map((term) => term.name);
    const joined = uniqueStrings(terms).join(", ");
    if (joined) {
      return joined;
    }
  }

  return "";
}

function firstImage(product) {
  return product.images?.[0]?.src || product.images?.[0]?.thumbnail || "";
}

function getCategoryType(product) {
  const categoryNames = (product.categories || []).map((category) => category.name);
  const preferred = categoryNames.find((name) =>
    ["spijlen", "baluster", "balusters", "trapspijlen"].some((word) =>
      normalizeText(name).includes(word),
    ),
  );

  return preferred || categoryNames[0] || "";
}

function getMaterialGroup(product) {
  const categoryNames = (product.categories || []).map((category) => category.name);
  const preferred = categoryNames.find((name) =>
    ["metalen", "smeedijzeren", "houten", "rvs", "stalen"].some((word) =>
      normalizeText(name).includes(word),
    ),
  );

  return preferred || "";
}

function inferFinish(product) {
  const explicitFinish = extractAttribute(product, ["Afwerking", "Kleur"]);
  if (explicitFinish) {
    return explicitFinish;
  }

  const text = `${stripHtml(product.short_description)} ${stripHtml(product.description)}`;
  const normalized = normalizeText(text);

  if (normalized.includes("mat zwart")) {
    return "Mat zwart";
  }

  if (normalized.includes("zwart gecoat") || normalized.includes("gecoat")) {
    return "Gecoat";
  }

  if (normalized.includes("rvs") || normalized.includes("roestvrij staal")) {
    return "RVS";
  }

  if (normalized.includes("onbehandeld")) {
    return "Onbehandeld";
  }

  return "";
}

function shouldIncludeProduct(product) {
  const name = normalizeText(product.name);
  const categoryText = normalizeText((product.categories || []).map((item) => item.name).join(" "));
  const tagText = normalizeText((product.tags || []).map((item) => item.name).join(" "));
  const haystack = `${name} ${categoryText} ${tagText}`;

  const hasIncludeWord =
    INCLUDE_NAME_WORDS.some((word) => name.includes(word)) ||
    normalizeText(tagText).includes("trapspijl");
  const hasExcludeWord = EXCLUDE_NAME_WORDS.some((word) => name.includes(word));

  return hasIncludeWord && !hasExcludeWord && Boolean(product.sku);
}

function toRecord(product) {
  const code = String(product.sku || "").trim();
  const productName = stripHtml(product.name);
  const diameter = extractAttribute(product, ["diameter", "doorsnede"]);
  const length = extractAttribute(product, ["Lengte", "length"]);
  const finish = inferFinish(product);
  const category = getCategoryType(product);
  const materialGroup = getMaterialGroup(product);
  const styleNames = extractAttribute(product, ["stijl"]);

  return {
    code,
    normalizedCode: normalizeCode(code),
    productName,
    imageUrl: firstImage(product),
    productUrl: product.permalink || "",
    diameter,
    length,
    finish,
    category,
    materialGroup,
    styles: uniqueStrings(styleNames.split(",")),
  };
}

function dedupeProducts(products) {
  const byCode = new Map();

  for (const product of products) {
    const key = product.normalizedCode || normalizeCode(product.code);
    if (!key) {
      continue;
    }

    const existing = byCode.get(key);
    if (!existing) {
      byCode.set(key, product);
      continue;
    }

    const existingScore = scoreCompleteness(existing);
    const newScore = scoreCompleteness(product);
    if (newScore > existingScore) {
      byCode.set(key, product);
    }
  }

  return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code, "nl"));
}

function scoreCompleteness(product) {
  return [
    product.productName,
    product.imageUrl,
    product.productUrl,
    product.diameter,
    product.length,
    product.finish,
    product.category,
    product.materialGroup,
  ].filter(Boolean).length;
}

async function main() {
  console.log("[scrape] Starting refresh for Spijl in Stijl");

  await fetchAllCategories();
  const products = await fetchAllProducts();

  const filtered = products.filter(shouldIncludeProduct);
  console.log(`[scrape] Candidate spijlen found: ${filtered.length}`);

  const records = dedupeProducts(filtered.map(toRecord));
  console.log(`[scrape] Unique spijlen after cleanup: ${records.length}`);

  const payload = {
    generatedAt: new Date().toISOString(),
    source: BASE_URL,
    total: records.length,
    items: records,
  };

  const fs = await import("node:fs/promises");
  await fs.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2), "utf8");

  console.log(`[scrape] Saved ${records.length} items to ${OUTPUT_FILE}`);
}

main().catch((error) => {
  console.error("[scrape] Failed:", error);
  process.exitCode = 1;
});
