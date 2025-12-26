import { getConfig } from './config/index.js';
import { startServer } from './api/server.js';
import { createChildLogger } from './utils/logger.js';

const logger = createChildLogger('main');

async function main() {
  try {
    const config = getConfig();
    const port = parseInt(process.env.PORT || '3000', 10);

    logger.info({ port }, 'Starting Medicaid RAG server');

    await startServer(config, port);
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

main();
