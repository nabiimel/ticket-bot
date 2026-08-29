import { syncCommands } from "./lib/deploy.js";

// Manual command registration: forces a global PUT regardless of the cached hash.
await syncCommands({ force: true });
