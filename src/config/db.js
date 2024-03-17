require('dotenv').config();
const mongoose = require('mongoose');

const dbURI = "mongodb+srv://Glacier670:GlacierBeam_670@cluster0.hd1uvyc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Successfully connected to MongoDB.");
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB.");
    console.error("Connection Error: ", err.message);
  });

// To handle the case where the initial connection is successful,
// but the database connection gets disconnected later on.
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB connection was disconnected.');
});

// To handle the reconnection when the connection to MongoDB is back.
mongoose.connection.on('reconnected', () => {
  console.log('Reconnected to MongoDB.');
});

// To handle the error after the initial connection was established.
mongoose.connection.on('error', (err) => {
  console.error('Error in MongoDB connection: ' + err.message);
});

// This is to ensure that the Node.js's native promise is used by Mongoose.
mongoose.Promise = global.Promise;
