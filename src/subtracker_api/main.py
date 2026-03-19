from fastapi import FastAPI

from subtracker_api.api.routes import health, subscriptions
from subtracker_api.core.config import settings
from subtracker_api.repositories.memory_subscription_repo import MemorySubscriptionRepository


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        description="MVP API for tracking subscriptions and recurring charges.",
    )
    app.state.subscription_repo = MemorySubscriptionRepository()
    app.include_router(health.router)
    app.include_router(subscriptions.router)
    return app


app = create_app()

