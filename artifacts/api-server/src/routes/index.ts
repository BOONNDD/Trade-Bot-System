import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import statusRouter from "./status.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(statusRouter);

export default router;
