import { Router, type IRouter } from "express";
import healthRouter from "./health";
import walletsRouter from "./wallets";

const router: IRouter = Router();

router.use(healthRouter);
router.use(walletsRouter);

export default router;
