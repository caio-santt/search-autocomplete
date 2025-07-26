import express from "express";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import bodyParser from "body-parser";
import cors from "cors";

const typeDefs = /* GraphQL */ `
  type Suggestion {
    text: String!
    type: String!
  }

  type Query {
    suggestions(term: String!): [Suggestion!]!
  }
`;

const resolvers = {
  Query: {
    suggestions: async (_: unknown, args: { term: string }) => {
      const term = String(args.term ?? "").trim();

      // Opcional: mesma regra do front/back — só busca com ≥ 4 chars
      if (term.length < 4) return [];

      try {
        const url = new URL("http://api:8000/suggest");
        url.searchParams.set("term", term);

        // Node 20 já tem fetch nativo
        const r = await fetch(url, {
          headers: { "accept": "application/json" },
        });

        if (!r.ok) {
          console.error("API /suggest error:", r.status, await r.text());
          return [];
        }

        const data: Array<{ text: string; type: string }> = await r.json();

        // Sanitiza shape (evita valores inesperados)
        return Array.isArray(data)
          ? data
              .filter((x) => x && typeof x.text === "string" && typeof x.type === "string")
              .map((x) => ({ text: x.text, type: x.type }))
          : [];
      } catch (err) {
        console.error("Gateway fetch error:", err);
        return [];
      }
    },
  },
};

async function bootstrap() {
  const server = new ApolloServer({ typeDefs, resolvers });
  await server.start();

  const app = express();

  app.use(
    "/graphql",
    cors<cors.CorsRequest>({ origin: true, credentials: true }),
    bodyParser.json(),
    expressMiddleware(server)
  );

  const PORT = Number(process.env.PORT || 4000);
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Gateway GraphQL em http://0.0.0.0:${PORT}/graphql`);
  });
}

bootstrap().catch((e) => {
  console.error("Falha ao iniciar o Gateway:", e);
  process.exit(1);
});
