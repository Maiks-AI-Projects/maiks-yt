import type { FastifyInstance } from "fastify";

import { registerMusicAccountRoutes } from "./music-account.route.js";
import { registerMusicAdminRoutes } from "./music-admin.route.js";
import { registerMusicPublicRoutes } from "./music-public.route.js";
import type { MusicRouteDependencies } from "./music-route.types.js";

export const registerMusicRoutes = (
  server: FastifyInstance,
  dependencies: MusicRouteDependencies
): void => {
  registerMusicPublicRoutes(server, dependencies);
  registerMusicAccountRoutes(server, dependencies);
  registerMusicAdminRoutes(server, dependencies);
};

export type { MusicRouteDependencies } from "./music-route.types.js";
