import { GraphQLClient } from "graphql-request";

const endpoint = process.env.WORDPRESS_API_URL;

if (!endpoint) {
  throw new Error(
    "WORDPRESS_API_URL is not set. Add it to .env.local — e.g. http://tpj.local/graphql"
  );
}

export const wpClient = new GraphQLClient(endpoint, {
  fetch: (url, init) =>
    fetch(url, { ...init, next: { revalidate: 60 } }),
});
