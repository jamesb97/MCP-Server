###### How you can test quickly on your machine (recommended)

Open two separate terminal tabs/windows.
Terminal A — start the server:

Use development mode (keeps logs visible):
`
npm run dev`
You should see a line like: MCP Server listening on port 3000

Leave this terminal open.

Terminal B — run the TypeScript test client:
`
npx ts-node src/test-client.ts`
Expected behavior:

Terminal B prints each test step including the echo response:
"Connected to MCP server"
"Testing echo tool:" and then the response like { message: 'Hello, MCP Server!' }
Terminal A shows the per-connection logs (Received data, Processing message, Sending response).
If you prefer a single-line (no ts-node) test client (works if server is running in Terminal A), run in Terminal B:
`node -e "const net=require('net');const c=net.createConnection(3000,'127.0.0.1',()=>{c.write(JSON.stringify({tool:'echo',params:{message:'hello from node'}})+'\n');});c.on('data',d=>{console.log('RECV',d.toString());c.end();});c.on('error',e=>{console.error('ERR',e);process.exit(1)});"`
Expected output:

RECV {"message":"hello from node"} (or similar JSON wrapped by server)
If the server fails to stay running

Copy the server log file (or paste the terminal output) here so I can inspect the reason it exits.
Run a quick check to see if anything is listening on 3000:
`lsof -i :3000`

If there is output, it means something is already using that port. You can either stop that process or change the port in the server code (src/server.ts) and restart.
