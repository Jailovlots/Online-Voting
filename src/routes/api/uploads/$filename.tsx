import { createFileRoute } from "@tanstack/react-router";
import * as fs from "fs/promises";
import * as path from "path";

export const Route = createFileRoute("/api/uploads/$filename")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { filename } = params;

        // Prevent directory traversal attacks by using only the base name
        const safeFilename = path.basename(filename);
        const filePath = path.join(process.cwd(), "public", "uploads", safeFilename);

        try {
          const buffer = await fs.readFile(filePath);

          // Determine content type
          let contentType = "image/png";
          const ext = path.extname(safeFilename).toLowerCase();
          if (ext === ".jpg" || ext === ".jpeg") {
            contentType = "image/jpeg";
          } else if (ext === ".gif") {
            contentType = "image/gif";
          } else if (ext === ".webp") {
            contentType = "image/webp";
          } else if (ext === ".svg") {
            contentType = "image/svg+xml";
          }

          return new Response(buffer, {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch {
          return new Response("Image Not Found", { status: 404 });
        }
      },
    },
  },
});
