// local dev only: faucet on, happy open now
process.env.DEV_FAUCET = '1'; process.env.HAPPY_START = '1'; require('../server/index.js');
