// app.js
import express from "express";
import { createServer } from "http";
import { initializeWebSocket } from "./utils/websocket.js";
import { dbConnection } from "./database/dbConnection.js";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import fileUpload from "express-fileupload";
import { errorMiddleware } from "./middlewares/error.js";
import messageRouter from "./router/messageRouter.js";
import userRouter from "./router/userRouter.js";
import appointmentRouter from "./router/appointmentRouter.js";
import descriptionRouter from "./router/descriptionRouter.js";
import chatRouter from "./router/chatRoutes.js";
import videoCallRouter from "./router/videocall.Router.js";
const app = express();
config({ path: "./config/config.env" });

const httpServer = createServer(app);
initializeWebSocket(httpServer);

app.use(
  cors({
    origin: [process.env.FRONTEND_URL_ONE, process.env.LOCAL_FRONTEND_URL_ONE, process.env.LOCAL_FRONTEND_URL_TWO,process.env.FRONTEND_URL_TWO, process.env.FRONTEND_URL_ONE1, process.env.FRONTEND_URL_TWO2],
    methods: ["GET", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "/tmp/",
  })
);

// Routes
app.use("/api/v1/message", messageRouter);
app.use("/api/v1/user", userRouter);
app.use("/api/v1/appointment", appointmentRouter);
app.use("/api/v1/descriptions", descriptionRouter);
app.use("/api/v1/chat", chatRouter);
app.use("/api/v1/videocall", videoCallRouter);


dbConnection();

app.use(errorMiddleware);

export { httpServer as app };