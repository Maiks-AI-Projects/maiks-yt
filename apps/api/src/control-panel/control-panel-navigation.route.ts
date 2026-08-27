import type { DatabasePool } from "@maiks-yt/database";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { RequireUrlAccessTokenForRequest } from "../url-access-token-request-access.service.js";
import { createControlPanelNavigation } from "./control-panel-navigation.service.js";
import { ControlPanelNavigationStoreService } from "./control-panel-navigation-store.service.js";

const navigationQuerySchema = z.object({
  accessToken: z.string().trim().min(16).max(512)
});

type ControlPanelNavigationRouteDependencies = {
  getDatabasePool: () => DatabasePool;
  requireUrlAccessTokenForRequest: RequireUrlAccessTokenForRequest;
};

export const registerControlPanelNavigationRoutes = (
  server: FastifyInstance,
  dependencies: ControlPanelNavigationRouteDependencies
): void => {
  server.get("/control/navigation", async (request, reply) => {
    const parsedQuery = navigationQuerySchema.safeParse(request.query);

    if (!parsedQuery.success) {
      reply.code(400);
      return {
        ok: false,
        reason: "control_navigation_request_invalid"
      };
    }

    const access = await dependencies.requireUrlAccessTokenForRequest(request, {
      deniedReason: "control_panel_access_denied",
      token: parsedQuery.data.accessToken,
      surface: "control-panel",
      scope: "control:open",
      userUnlinkedReason: "control_panel_user_unlinked"
    });

    if (!access.ok) {
      reply.code(access.statusCode);
      return {
        ok: false,
        reason: access.reason
      };
    }

    if (!access.user) {
      reply.code(401);
      return {
        ok: false,
        reason: "not_authenticated"
      };
    }

    try {
      const store = new ControlPanelNavigationStoreService(dependencies.getDatabasePool());
      const rolePermissionValues = await store.listActiveRolePermissionValues(access.user.id);

      return {
        ok: true,
        pages: createControlPanelNavigation(rolePermissionValues)
      };
    } catch (error) {
      server.log.warn({ err: error }, "Control navigation projection failed.");
      reply.code(503);
      return {
        ok: false,
        reason: "control_navigation_unavailable"
      };
    }
  });
};
