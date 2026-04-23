import { Router, type IRouter } from "express";
import healthRouter from "./health";
import reelPromptRouter from "./reel-prompt";
import frameSessionsRouter from "./frame-sessions";
import generationRouter from "./generation";
import userKeysRouter from "./user-keys";
import adminRouter from "./admin";
import aiProvidersRouter from "./ai-providers";
import aiSystemsRouter from "./ai-systems";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/user-keys", userKeysRouter);
router.use(reelPromptRouter);
router.use(frameSessionsRouter);
router.use(generationRouter);
router.use(adminRouter);
router.use(aiProvidersRouter);
router.use(aiSystemsRouter);

export default router;
