import type {
  PublicProjectDetail,
  PublicProjectSummary
} from "@maiks-yt/domain/projects";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://api-dev.maiks.yt";

type ProjectListApiResponse =
  | {
    ok: true;
    projects: readonly PublicProjectSummary[];
  }
  | {
    ok: false;
    reason: string;
  };

type ProjectDetailApiResponse =
  | {
    ok: true;
    project: PublicProjectDetail;
  }
  | {
    ok: false;
    reason: string;
  };

export type ProjectListLoadResult =
  | {
    status: "loaded";
    projects: readonly PublicProjectSummary[];
  }
  | {
    status: "error";
  };

export type ProjectDetailLoadResult =
  | {
    status: "loaded";
    project: PublicProjectDetail;
  }
  | {
    status: "not-found";
  }
  | {
    status: "error";
  };

export const formatProjectLabel = (value: string): string =>
  value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getPublicProjects = async (): Promise<ProjectListLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/projects`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return {
        status: "error"
      };
    }

    const payload = await response.json() as ProjectListApiResponse;

    if (!payload.ok) {
      return {
        status: "error"
      };
    }

    return {
      status: "loaded",
      projects: payload.projects
    };
  } catch {
    return {
      status: "error"
    };
  }
};

export const getPublicProject = async (slug: string): Promise<ProjectDetailLoadResult> => {
  try {
    const response = await fetch(`${apiBaseUrl}/projects/${encodeURIComponent(slug)}`, {
      cache: "no-store"
    });

    if (response.status === 404) {
      return {
        status: "not-found"
      };
    }

    if (!response.ok) {
      return {
        status: "error"
      };
    }

    const payload = await response.json() as ProjectDetailApiResponse;

    if (!payload.ok) {
      return payload.reason === "project_not_found"
        ? { status: "not-found" }
        : { status: "error" };
    }

    return {
      status: "loaded",
      project: payload.project
    };
  } catch {
    return {
      status: "error"
    };
  }
};
