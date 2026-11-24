import { GraphQLClient } from "graphql-request";

const endpoint = process.env.WORDPRESS_API_URL;

if (!endpoint) {
  throw new Error(
    "WORDPRESS_API_URL is not set. Add it to .env.local — e.g. http://tpj.local/graphql"
  );
}

export const wpClient = new GraphQLClient(endpoint, {
  fetch: (url, init) =>
    // One hour: WordPress refreshes the affected pages on every save
    // (app/api/revalidate), so the timer only bounds staleness for
    // anything the save hook misses. Shorter windows overload the CMS.
    fetch(url, { ...init, next: { revalidate: 3600 } }),
});

/**
 * Authenticated client for draft previews: a WordPress application
 * password for a dedicated preview user. Never cached.
 */
const previewUser = process.env.WP_PREVIEW_USER;
const previewPass = process.env.WP_PREVIEW_APP_PASSWORD;

export const wpPreviewClient = new GraphQLClient(endpoint, {
  headers:
    previewUser && previewPass
      ? {
          Authorization:
            "Basic " + Buffer.from(`${previewUser}:${previewPass}`).toString("base64"),
        }
      : undefined,
  fetch: (url, init) => fetch(url, { ...init, cache: "no-store" }),
});
