import { Router } from "express";
import healthRouter from "./health";
import emergencyRouter from "./emergency";
import contactsRouter from "./contacts";
import chatRouter from "./chat";
import gpsRouter from "./gps";
import statsRouter from "./stats";
import openaiRouter from "./openai/index";

const router = Router();

router.use(healthRouter);
router.use(emergencyRouter);
router.use(contactsRouter);
router.use(chatRouter);
router.use(gpsRouter);
router.use(statsRouter);
router.use(openaiRouter);

export default router;
