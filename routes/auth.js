import { Router } from "express";
import {
  getCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  updateCurrentUserProfile,
} from "../services/authService.js";
import { getUserAiSettings, updateUserAiSettings } from "../db/users.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const result = await loginUser(res, {
      email: req.body?.email,
      password: req.body?.password,
    });
    res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    console.warn("[auth/login]", error?.message || error);
    res.status(500).json({ success: false, error: "Unable to sign in right now." });
  }
});

router.post("/register", async (req, res) => {
  try {
    const result = await registerUser(res, {
      name: req.body?.name,
      email: req.body?.email,
      password: req.body?.password,
      department: req.body?.department,
      position: req.body?.position,
    });
    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    console.warn("[auth/register]", error?.message || error);
    res
      .status(500)
      .json({ success: false, error: "Unable to create your account right now." });
  }
});

router.post("/logout", async (_req, res) => {
  try {
    const result = await logoutUser(res);
    res.json(result);
  } catch {
    res.status(500).json({ success: false, error: "Unable to sign out." });
  }
});

router.get("/me", async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, user: null });
    }
    res.json({ success: true, user });
  } catch {
    res
      .status(500)
      .json({ success: false, user: null, error: "Unable to load session." });
  }
});

router.patch("/profile", async (req, res) => {
  try {
    const result = await updateCurrentUserProfile(req, res, req.body || {});
    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.warn("[auth/profile]", error?.message || error);
    res.status(500).json({ success: false, error: "Unable to update profile." });
  }
});

router.get("/ai-settings", async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "Sign in required." });
    }
    const settings = await getUserAiSettings(user.id);
    if (!settings) {
      return res.status(404).json({ success: false, error: "User not found." });
    }
    res.json({ success: true, settings });
  } catch (error) {
    console.warn("[auth/ai-settings GET]", error?.message || error);
    res.status(500).json({
      success: false,
      error: "Unable to load AI settings.",
    });
  }
});

router.patch("/ai-settings", async (req, res) => {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return res.status(401).json({ success: false, error: "Sign in required." });
    }

    const result = await updateUserAiSettings(user.id, {
      provider: req.body?.provider,
      geminiApiKey: req.body?.geminiApiKey,
      openaiApiKey: req.body?.openaiApiKey,
      clearGemini: Boolean(req.body?.clearGemini),
      clearOpenai: Boolean(req.body?.clearOpenai),
    });

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.warn("[auth/ai-settings PATCH]", error?.message || error);
    res.status(500).json({
      success: false,
      error: "Unable to save AI settings.",
    });
  }
});

export default router;
