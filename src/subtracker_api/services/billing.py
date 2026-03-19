from __future__ import annotations

import calendar
from datetime import date, timedelta

from subtracker_api.models.subscription import Cadence, SubscriptionCreate


def _last_day_of_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _next_month(year: int, month: int) -> tuple[int, int]:
    if month == 12:
        return year + 1, 1
    return year, month + 1


def _safe_date(year: int, month: int, day: int) -> date:
    return date(year, month, min(day, _last_day_of_month(year, month)))


def _next_weekly_occurrence(start_date: date, reference_date: date) -> date:
    if reference_date <= start_date:
        return start_date

    delta_days = (reference_date - start_date).days
    remainder = delta_days % 7
    if remainder == 0:
        return reference_date
    return reference_date + timedelta(days=7 - remainder)


def _next_monthly_occurrence(start_date: date, anchor_day: int, reference_date: date) -> date:
    effective_reference = max(start_date, reference_date)
    year, month = effective_reference.year, effective_reference.month
    candidate = _safe_date(year, month, anchor_day)

    if candidate < effective_reference:
        year, month = _next_month(year, month)
        candidate = _safe_date(year, month, anchor_day)

    return candidate


def _next_yearly_occurrence(start_date: date, reference_date: date) -> date:
    effective_reference = max(start_date, reference_date)
    candidate = _safe_date(effective_reference.year, start_date.month, start_date.day)

    if candidate < effective_reference:
        candidate = _safe_date(effective_reference.year + 1, start_date.month, start_date.day)

    return candidate


def calculate_next_charge(payload: SubscriptionCreate, today: date | None = None) -> date:
    reference = today or date.today()

    if payload.cadence == Cadence.WEEKLY:
        return _next_weekly_occurrence(payload.start_date, reference)

    if payload.cadence == Cadence.YEARLY:
        return _next_yearly_occurrence(payload.start_date, reference)

    anchor_day = payload.day_of_month or payload.start_date.day
    return _next_monthly_occurrence(payload.start_date, anchor_day, reference)

