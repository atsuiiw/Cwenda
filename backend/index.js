import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// dotenv
dotenv.config();
const PORT = process.env.PORT;
// const FRONTEND_URL = process.env.FRONTEND_URL;

// initialize app variable
const app = express();
app.use(express.json());

// app.use(cors({
//   origin: FRONTEND_URL,
//   methods: ['GET', 'POST', 'PUT', 'DELETE'],
//   credentials: true,
// }));

// databse connection
import pool from './db/db.js';

// import router
import router from './router/router.js';

app.get('/', (req,res) => {
  return res.send("Server is Ready");
})

app.use('/api',router);

app.use((err, req, res, next) => {
  console.error("MIDDLEWARE ERROR:", err);
  res.status(err.status || 500).json({ message: err.message });
});

app.listen(PORT, async () => {
    try {
        await pool.query('SELECT 1');
        console.log("Connected at " + PORT);
    } catch (err) {
        console.error("Database connection failed:", err.message);
    }
});
