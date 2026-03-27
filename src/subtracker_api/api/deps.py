from fastapi import Request

from subtracker_api.repositories.memory_statement_import_repo import MemoryStatementImportRepository
from subtracker_api.repositories.memory_subscription_repo import MemorySubscriptionRepository


def get_subscription_repo(request: Request) -> MemorySubscriptionRepository:
    return request.app.state.subscription_repo


def get_statement_import_repo(request: Request) -> MemoryStatementImportRepository:
    return request.app.state.statement_import_repo
