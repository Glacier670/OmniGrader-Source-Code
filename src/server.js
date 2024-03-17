const express = require('express');
const session = require('express-session');
const cors = require("cors");
const UserRouter = require('./api/User');
const MongoStore = require('connect-mongo');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
const port = process.env.PORT || 5000;
app.set('trust proxy', 1); // Trust first proxy

// Environment variables
require('dotenv').config();

// Database connection
require('./config/db');


// Define a list of allowed origins
const allowedOrigins = ['https://www.omnigrader.com', 'http://127.0.0.1:5500', 'http://www.omnigrader.com', `http://localhost:${port}`];

// CORS options
const corsOptions = {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || origin.startsWith("https://www.omnigrader.com")) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true, // to allow cookies
};
  
// Apply CORS with your options
app.use(cors(corsOptions));

app.use(cookieParser());

// Middlewares
app.use(express.json()); // For parsing application/json

// Session middleware setup
app.use(session({
  secret: process.env.AUTH_PASSWORD, // Secret key to sign the session ID cookie
  resave: false, // Forces the session to be saved back to the session store
  saveUninitialized: true, // Forces a session that is "uninitialized" to be saved to the store
  store: MongoStore.create({mongoUrl: process.env.MONGODB_URI}),
  cookie: { 
    sameSite: process.env.NODE_ENV === "production" ? 'none' : 'lax',
    secure:  process.env.NODE_ENV === "production", // True if in production
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24,
    domain: process.env.NODE_ENV === "production" ? '.omnigrader.com' : undefined
  }, // Cookie configuration
}));

// Routes
app.use('/user', UserRouter);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '..', 'public')));


// Starting the server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
