import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { experimental_createMCPClient } from "ai";

export async function createMCPClient({
  url,
  apiKey,
}: {
  url: string;
  apiKey: string;
}) {
  const awsProdHttpTransport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: {
      headers: {
        "x-api-key": apiKey,
      },
    },
  });
  return await experimental_createMCPClient({
    transport: awsProdHttpTransport,
  });
}
