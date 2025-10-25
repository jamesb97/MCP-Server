import { Socket } from "net";

async function sendMessage(client: Socket, message: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Request timed out"));
    }, 5000);

    const onData = (data: Buffer) => {
      clearTimeout(timeout);
      client.removeListener("data", onData);
      try {
        resolve(JSON.parse(data.toString()));
      } catch (error) {
        reject(error);
      }
    };

    client.on("data", onData);
    client.write(JSON.stringify(message) + "\n");
  });
}

async function runTests() {
  const client = new Socket();

  try {
    await new Promise<void>((resolve, reject) => {
      client.connect(3000, "127.0.0.1", () => resolve());
      client.on("error", reject);
    });

    console.log("Connected to MCP server");

    // Test echo tool
    console.log("\nTesting echo tool:");
    const echoResponse = await sendMessage(client, {
      tool: "echo",
      params: { message: "Hello, MCP Server!" },
    });
    console.log("Echo response:", echoResponse);

    // Test file content tool (write)
    console.log("\nTesting file content tool (write):");
    const writeResponse = await sendMessage(client, {
      tool: "fileContent",
      params: {
        operation: "write",
        path: "test.txt",
        content: "Hello from MCP Server!",
      },
    });
    console.log("Write response:", writeResponse);

    // Test file content tool (read)
    console.log("\nTesting file content tool (read):");
    const readResponse = await sendMessage(client, {
      tool: "fileContent",
      params: {
        operation: "read",
        path: "test.txt",
      },
    });
    console.log("Read response:", readResponse);

    // Test system info tool
    console.log("\nTesting system info tool:");
    const sysInfoResponse = await sendMessage(client, {
      tool: "systemInfo",
      params: {},
    });
    console.log("System info:", sysInfoResponse);

    // Test JSON processing tool (validation)
    console.log("\nTesting JSON validation:");
    const jsonValidateResponse = await sendMessage(client, {
      tool: "jsonProcess",
      params: {
        operation: "validate",
        data: { name: "John", age: 30 },
        schema: { name: "string", age: "number" },
      },
    });
    console.log("JSON validation result:", jsonValidateResponse);

    // Test JSON processing tool (transformation)
    console.log("\nTesting JSON transformation:");
    const jsonTransformResponse = await sendMessage(client, {
      tool: "jsonProcess",
      params: {
        operation: "transform",
        data: { oldName: "John", age: 30 },
        transformations: [
          { operation: "rename", path: "oldName", newPath: "name" },
          {
            operation: "add",
            path: "createdAt",
            value: new Date().toISOString(),
          },
        ],
      },
    });
    console.log("JSON transformation result:", jsonTransformResponse);
  } catch (error) {
    console.error("Error during tests:", error);
  } finally {
    try {
      client.end();
    } catch (e) {
      client.destroy();
    }
  }
}

runTests().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
