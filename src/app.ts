import "reflect-metadata";
import express from "express";
import { AppDataSource } from "./config/database";
import userRoute from "./Routes/userRoutes";

const app = express();

app.use(express.json());

app.use("/api", userRoute);
AppDataSource.initialize()
  .then(() => {
    console.log("Database Connected");
  })
  .catch((error) => {
    console.log("Database connnectioon Failed", error);
  });

const PORT = 7000 | 8000;

app.listen(PORT, () => {
  console.log(`Server running at ${PORT}`);
});
