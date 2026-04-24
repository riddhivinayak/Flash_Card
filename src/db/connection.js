const mongoose = require('mongoose');

async function connect(uri) {
  await mongoose.connect(uri || process.env.MONGODB_URI);
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect };
