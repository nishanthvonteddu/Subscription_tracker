from fastapi import Request

from subtracker_api.repositories.memory_subscription_repo import MemorySubscriptionRepository


def get_subscription_repo(request: Request) -> MemorySubscriptionRepository:
    return request.app.state.subscription_repo

