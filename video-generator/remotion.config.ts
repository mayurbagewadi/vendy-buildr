import { Config } from "remotion";

/**
 * Video Generator Configuration
 */
Config.setVideoImageFormat("png");

// Set concurrency for faster rendering
Config.setConcurrency(4);

// Memory usage limit (MB)
Config.setMemoryLimit(2048);

// Timeout for video rendering (seconds)
Config.setChromiumMultiProcessOnLinux(true);
