require("dotenv").config();
import http from "http";
import { Client } from "@notionhq/client";
import { Octokit } from "@octokit/core";

// The dotenv library will read from your .env file into these values on `process.env`
const notionDatabaseId = process.env.NOTION_DATABASE_ID;
const notionSecret = process.env.NOTION_SECRET;
const githubPAS = process.env.PAS;

// Will provide an error to users who forget to create the .env file
// with their Notion data in it
if (!notionDatabaseId || !notionSecret) {
  throw Error("Must define NOTION_SECRET and NOTION_DATABASE_ID in env");
}

// Initializing the Notion client with your secret
const notion = new Client({
  auth: notionSecret,
});

const octokit = new Octokit({
  auth: githubPAS,
});

const host = "localhost";
const port = 8000;

// Require an async function here to support await with the DB query
const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.url?.includes("?email=")) {
    try {
      const email = req.url.split("?email=")[1];
      console.log("email", email);
      const isAuthorized = await checkNotionUserAuth(email, notionDatabaseId);
      switch (req.method) {
        case "GET":
          res.setHeader("Content-Type", "application/json");
          res.writeHead(200);
          res.end(JSON.stringify({ isAuthorized }));
          break;
        case "POST":
          if (!isAuthorized) {
            res.setHeader("Content-Type", "application/json");
            res.writeHead(401);
            res.end(JSON.stringify({ message: "Unauthorized" }));
            return;
          }
          const result = await octokit.request(
            "POST /repos/huongnguyenduc/docu-notion/actions/workflows/release.yml/dispatches",
            {
              ref: "main",
            }
          );
          if (result.status === 204) {
            res.setHeader("Content-Type", "application/json");
            res.writeHead(200);
            res.end(JSON.stringify({ message: "success" }));
          } else {
            res.setHeader("Content-Type", "application/json");
            res.writeHead(500);
            res.end(JSON.stringify({ message: "error" }));
          }
          break;
        default:
          res.setHeader("Content-Type", "application/json");
          res.writeHead(405);
          res.end(JSON.stringify({ error: "Method not allowed" }));
          break;
      }
    } catch (error) {
      console.log(error);
      res.setHeader("Content-Type", "application/json");
      res.writeHead(500);
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  } else {
    res.setHeader("Content-Type", "application/json");
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Resource not found" }));
  }
});

server.listen(port, () => {
  console.log(`Server is running on http://${host}:${port}`);
});

async function checkNotionUserAuth(email: string, notionDatabaseId: string) {
  const query = await notion.databases.query({
    database_id: notionDatabaseId,
    filter: {
      property: "email",
      email: {
        equals: email,
      },
    },
  });

  console.log("query", query.results);
  return query.results.length > 0;
}
