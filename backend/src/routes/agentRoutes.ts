import { Router } from "express";
import { getCoastalIntelligence } from "../services/agentIntelligenceService";

const router = Router();

router.get("/coastal-intelligence/:location", async (req, res) => {
  try {
    const { location } = req.params;

    const intelligence = await getCoastalIntelligence(location);

    res.json({
      service: "CoastAlert Agent Intelligence",
      status: "success",
      ...intelligence
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      error: "Failed to generate coastal intelligence"
    });
  }
});

export default router;
