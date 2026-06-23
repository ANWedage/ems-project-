require('dotenv').config();
const app = require('./app');
const { connectMaster } = require('./config/masterDb');

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await connectMaster();
    app.listen(PORT, () => {
      console.log(`EMS backend listening on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
