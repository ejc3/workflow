import { getWorld } from 'workflow/runtime';

export async function GET() {
  const startTime = Date.now();

  try {
    const world = getWorld();

    // Check database health
    const healthCheck = await world.checkHealth();

    // Get auth info (contains database type info)
    const authInfo = await world.getAuthInfo();

    // Try to get recent runs to verify full system health
    let runsHealthy = false;
    let runsError: string | undefined;
    try {
      await world.runs.list({ limit: 1 });
      runsHealthy = true;
    } catch (err) {
      runsError = err instanceof Error ? err.message : String(err);
    }

    const responseTime = Date.now() - startTime;

    const response = {
      status: healthCheck.success && runsHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      database: {
        type: authInfo.environment, // This is set to the db type in world-sql
        healthy: healthCheck.success,
        message: healthCheck.message,
      },
      storage: {
        healthy: runsHealthy,
        error: runsError,
      },
      environment: {
        ownerId: authInfo.ownerId,
        projectId: authInfo.projectId,
      },
      checks: {
        connection: healthCheck.success ? 'pass' : 'fail',
        storage: runsHealthy ? 'pass' : 'fail',
      },
    };

    const statusCode = response.status === 'healthy' ? 200 : 503;

    return Response.json(response, { status: statusCode });
  } catch (error) {
    const responseTime = Date.now() - startTime;

    return Response.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        responseTime: `${responseTime}ms`,
        error: error instanceof Error ? error.message : String(error),
        checks: {
          connection: 'fail',
          storage: 'fail',
        },
      },
      { status: 503 }
    );
  }
}
