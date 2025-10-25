import { createServer, Server, Socket } from "net";
import { promises as fs } from "fs";
import { join } from "path";
import * as os from "os";
import { cpus } from "os";

type CalculateOperation = "add" | "subtract" | "multiply" | "divide";
type JSONTransformOperation = "rename" | "delete" | "add";

interface Tool<T = any, R = any> {
  name: string;
  description: string;
  execute: (params: T) => Promise<R>;
}

interface CalculateParams {
  operation: CalculateOperation;
  a: number;
  b: number;
}

interface FileContentParams {
  operation: "read" | "write";
  path: string;
  content?: string;
}

interface JSONTransformation {
  operation: JSONTransformOperation;
  path: string;
  value?: any;
  newPath?: string;
}

interface JSONProcessParams {
  operation: "validate" | "transform";
  data: any;
  schema?: Record<string, any>;
  transformations?: JSONTransformation[];
}

class MCPServer {
  private readonly tools: Map<string, Tool> = new Map();
  private server: Server | null = null;

  constructor(private readonly port: number = 3000) {
    this.tools.set("echo", {
      name: "echo",
      description: "A simple echo tool that returns the input",
      execute: async (params: { message: string }) => {
        return { message: params.message };
      },
    });

    // List directory tool
    this.registerTool({
      name: "listDir",
      description: "Lists the contents of a directory",
      execute: async (params: { path: string }) => {
        try {
          const files = await fs.readdir(params.path, { withFileTypes: true });
          return {
            items: files.map((file) => ({
              name: file.name,
              isDirectory: file.isDirectory(),
            })),
          };
        } catch (error) {
          throw new Error(
            `Failed to list directory: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      },
    });

    // File search tool
    this.registerTool({
      name: "searchFiles",
      description: "Searches for files matching a pattern",
      execute: async (params: { path: string; pattern: string }) => {
        try {
          const allFiles = await fs.readdir(params.path, {
            withFileTypes: true,
          });
          const matches = allFiles
            .filter((file) => file.name.includes(params.pattern))
            .map((file) => ({
              name: file.name,
              isDirectory: file.isDirectory(),
              path: join(params.path, file.name),
            }));
          return { matches };
        } catch (error) {
          throw new Error(
            `Failed to search files: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      },
    });

    // Calculator tool
    this.registerTool({
      name: "calculate",
      description: "Performs basic mathematical operations",
      execute: async (params: {
        operation: "add" | "subtract" | "multiply" | "divide";
        a: number;
        b: number;
      }) => {
        const { operation, a, b } = params;
        let result: number;

        switch (operation) {
          case "add":
            result = a + b;
            break;
          case "subtract":
            result = a - b;
            break;
          case "multiply":
            result = a * b;
            break;
          case "divide":
            if (b === 0) throw new Error("Division by zero");
            result = a / b;
            break;
          default:
            throw new Error("Invalid operation");
        }

        return { result };
      },
    });

    // File content manipulation tool
    this.registerTool({
      name: "fileContent",
      description: "Read or write file content",
      execute: async (params: {
        operation: "read" | "write";
        path: string;
        content?: string;
      }) => {
        const { operation, path, content } = params;

        try {
          if (operation === "read") {
            const fileContent = await fs.readFile(path, "utf-8");
            return { content: fileContent };
          } else if (operation === "write" && content !== undefined) {
            await fs.writeFile(path, content, "utf-8");
            return { success: true };
          } else {
            throw new Error("Invalid operation or missing content for write");
          }
        } catch (error) {
          throw new Error(
            `File operation failed: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      },
    });

    // System information tool
    this.registerTool({
      name: "systemInfo",
      description:
        "Get system information including CPU, memory, and process info",
      execute: async () => {
        const cpuInfo = cpus();
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const uptime = os.uptime();
        const loadAvg = os.loadavg();

        return {
          cpu: {
            cores: cpuInfo.length,
            model: cpuInfo[0].model,
            speed: cpuInfo[0].speed,
          },
          memory: {
            total: totalMemory,
            free: freeMemory,
            used: totalMemory - freeMemory,
          },
          system: {
            platform: os.platform(),
            arch: os.arch(),
            uptime: uptime,
            loadAverage: loadAvg,
          },
        };
      },
    });

    // JSON processing tool
    this.registerTool({
      name: "jsonProcess",
      description: "Validate and transform JSON data",
      execute: async (params: {
        operation: "validate" | "transform";
        data: any;
        schema?: Record<string, any>;
        transformations?: Array<{
          operation: "rename" | "delete" | "add";
          path: string;
          value?: any;
          newPath?: string;
        }>;
      }) => {
        const { operation, data, schema, transformations } = params;

        if (operation === "validate" && schema) {
          const validateField = (value: any, schemaField: any): boolean => {
            if (typeof schemaField === "string") {
              return typeof value === schemaField;
            }
            if (
              typeof schemaField === "object" &&
              !Array.isArray(schemaField)
            ) {
              if (!value || typeof value !== "object") return false;
              return Object.entries(schemaField).every(([key, type]) =>
                validateField(value[key], type)
              );
            }
            return true;
          };

          const isValid = validateField(data, schema);
          return { isValid };
        }

        if (operation === "transform" && transformations) {
          let result = JSON.parse(JSON.stringify(data)); // Deep clone

          for (const t of transformations) {
            const pathParts = t.path.split(".");
            let current = result;

            // Navigate to the parent of the target
            for (let i = 0; i < pathParts.length - 1; i++) {
              current = current[pathParts[i]];
              if (!current) break;
            }

            if (current) {
              const lastPart = pathParts[pathParts.length - 1];
              switch (t.operation) {
                case "rename":
                  if (t.newPath) {
                    current[t.newPath] = current[lastPart];
                    delete current[lastPart];
                  }
                  break;
                case "delete":
                  delete current[lastPart];
                  break;
                case "add":
                  current[lastPart] = t.value;
                  break;
              }
            }
          }

          return { result };
        }

        throw new Error("Invalid operation or missing required parameters");
      },
    });
  }

  private registerTool(tool: Tool) {
    this.tools.set(tool.name, tool);
  }

  private async handleMessage(message: any): Promise<any> {
    try {
      const { tool, params } = message;
      const toolImpl = this.tools.get(tool);

      if (!toolImpl) {
        throw new Error(`Tool ${tool} not found`);
      }

      return await toolImpl.execute(params);
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  start() {
    const server = createServer((socket) => {
      console.log("Client connected");
      let buffer = "";

      socket.on("data", async (data) => {
        console.log("Received data:", data.toString().trim());
        buffer += data.toString();

        if (buffer.includes("\n")) {
          const messages = buffer.split("\n");
          buffer = messages.pop() || "";

          for (const msg of messages) {
            if (!msg.trim()) continue;

            try {
              console.log("Processing message:", msg.trim());
              const request = JSON.parse(msg);
              const response = await this.handleMessage(request);
              console.log("Sending response:", response);
              socket.write(JSON.stringify(response) + "\n");
            } catch (error) {
              console.error("Error processing message:", error);
              socket.write(
                JSON.stringify({
                  error: "Invalid message format",
                }) + "\n"
              );
            }
          }
        }
      });

      socket.on("error", (error) => {
        console.error("Socket error:", error);
      });

      socket.on("close", () => {
        console.log("Client disconnected");
      });
    });

    server.listen(this.port, () => {
      console.log(`MCP Server listening on port ${this.port}`);
    });

    return server;
  }
}

// Start the server
const server = new MCPServer();
const serverInstance = server.start();

// Handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down server...");
  serverInstance.close(() => {
    console.log("Server shut down successfully");
    process.exit(0);
  });
});
