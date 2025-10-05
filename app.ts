import express from "express";
import { router as index } from "./controller/index";

export const app = express();

app.use("/", index);
app.use("/", (req, res) => {
  res.send("Hello World!!!");
});
