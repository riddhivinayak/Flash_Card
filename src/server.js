require('dotenv').config();
const createApp = require('./app');
const { connect } = require('./db/connection');

const PORT = process.env.PORT || 3000;

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message);
  process.exit(1);
});

connect()
  .then(() => {
    const app = createApp();
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });
