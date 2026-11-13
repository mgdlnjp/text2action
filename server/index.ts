import "dotenv/config";
import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  const mode =
    config.mode === "ai"
      ? `IA (${config.model})`
      : "DÉMO — extraction par règles, aucun appel externe";
  console.info(`Text2Action API prête sur http://localhost:${config.port} · mode ${mode}`);
});
